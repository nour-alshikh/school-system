<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\School;
use App\Models\SchoolMembership;
use App\Models\User;
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
    ) {}

    /**
     * A new account and its school, together: neither is left behind if
     * the other fails.
     *
     * @param  array{name: string, email: string, password: string, school_name: string, slug: string}  $data
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

            return $this->addSchool($user, $data['school_name'], $data['slug']);
        });
    }

    /**
     * @return array{user: User, membership: SchoolMembership, token: string}
     */
    public function addSchool(User $user, string $name, string $slug): array
    {
        $this->ensureUnderLimit($user);

        ['school' => $school, 'membership' => $membership] = $this->provisioner->createForOwner($user, $name, $slug);

        // For the central dashboard (docs/self-service-schools-plan.md, phase 5).
        AuditLog::record('school.self_registered', $school, ['slug' => $slug], actor: $user);

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
