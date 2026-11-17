<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\School;
use App\Models\SchoolMembership;
use App\Models\User;
use App\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Self-service schools: anyone can create one and is its admin right away.
 * See docs/self-service-schools-plan.md.
 */
class SchoolSignupService
{
    public function __construct(
        private readonly SchoolProvisioner $provisioner,
        private readonly MembershipService $memberships,
        private readonly SchoolBlueprint $blueprints,
        private readonly TenantContext $context,
    ) {}

    /**
     * A new account and its school, together: neither is left behind if
     * the other fails.
     *
     * @param  array{name: string, email: string, password: string, school_name: string, slug: string, blueprint?: array|null}  $data
     * @return array{user: User, membership: SchoolMembership, token: string}
     */
    public function signUp(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
            ]);

            return $this->addSchool($user, $data['school_name'], $data['slug'], $data['blueprint'] ?? null);
        });
    }

    /**
     * The school, and its blueprint's structure when one is given
     * (docs/ai-assistant-plan.md, phase 2) — together, so a blueprint that
     * fails leaves no half-made school behind.
     *
     * @param  array|null  $blueprint  validated (SchoolBlueprint::rules())
     * @return array{user: User, membership: SchoolMembership, token: string}
     */
    public function addSchool(User $user, string $name, string $slug, ?array $blueprint = null): array
    {
        $this->ensureUnderLimit($user);

        ['school' => $school, 'membership' => $membership] = DB::transaction(function () use ($user, $name, $slug, $blueprint) {
            $created = $this->provisioner->createForOwner($user, $name, $slug);

            if ($blueprint) {
                $this->context->runAs($created['school'], fn () => $this->blueprints->apply($blueprint));
            }

            return $created;
        });

        // For the central dashboard (docs/self-service-schools-plan.md, phase 5).
        AuditLog::record('school.self_registered', $school, array_filter(['slug' => $slug, 'blueprint' => $blueprint ? true : null]), actor: $user);

        return [
            'user' => $user,
            'membership' => $membership,
            'token' => $this->memberships->issueToken($user, $membership),
        ];
    }

    /**
     * Anyone can create schools, so one account can't create an unbounded
     * number of them. Platform admins aren't limited.
     */
    private function ensureUnderLimit(User $user): void
    {
        $max = config('schools.max_self_service_per_user');

        if ($user->is_platform_admin || School::where('created_by_id', $user->id)->count() < $max) {
            return;
        }

        throw ValidationException::withMessages([
            'school_name' => __('api.school_limit', ['max' => $max]),
        ]);
    }
}
