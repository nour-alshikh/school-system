<?php

namespace App\Platform;

use App\Enums\MembershipRole;
use App\Enums\MembershipStatus;
use App\Models\AuditLog;
use App\Models\School;
use App\Models\SchoolMembership;
use App\Models\User;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * A system admin managing a school's admins and members
 * (docs/central-dashboard-plan.md, phase 6). Every action is audited. The
 * system admin never sees or sets a password: new admins and resets go
 * through the set-your-password email.
 */
class SchoolMembers
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly MembershipService $memberships,
    ) {}

    /**
     * An existing account becomes an admin here; a new email gets an
     * account and an invitation (the reset-password email).
     *
     * @return array{user: User, invited: bool}
     */
    public function addAdmin(School $school, string $name, string $email): array
    {
        [$user, $invited] = DB::transaction(function () use ($school, $name, $email) {
            $user = User::where('email', $email)->first();
            $invited = $user === null;
            $user ??= User::create([
                'name' => $name,
                'email' => $email,
                // Never used: they set their own through the email.
                'password' => Hash::make(Str::random(64)),
            ]);

            $this->context->runAs($school, fn () => $this->memberships->grant($user, MembershipRole::Admin));

            return [$user, $invited];
        });

        if ($invited) {
            Password::sendResetLink(['email' => $user->email]);
        }

        AuditLog::record('school.admin_added', $user, ['email' => $user->email, 'invited' => $invited], $school);

        return ['user' => $user, 'invited' => $invited];
    }

    /** The admin role goes; refused for the school's last active admin. */
    public function removeAdmin(School $school, User $user): void
    {
        $this->guardLastAdmin($school, $user->id);

        $this->context->runAs($school, fn () => $this->memberships->revoke($user, MembershipRole::Admin));

        AuditLog::record('school.admin_removed', $user, ['email' => $user->email], $school);
    }

    /**
     * Suspends or reactivates a membership. A suspended member's session
     * ends on their next request (ResolveSchool).
     */
    public function setStatus(SchoolMembership $membership, MembershipStatus $status): void
    {
        if ($status !== MembershipStatus::Active && $membership->role === MembershipRole::Admin) {
            $this->guardLastAdmin($membership->school, $membership->user_id);
        }

        $membership->update(['status' => $status, 'ended_at' => $status === MembershipStatus::Active ? null : $membership->ended_at]);

        AuditLog::record(
            $status === MembershipStatus::Active ? 'school.member_reactivated' : 'school.member_suspended',
            $membership->user,
            ['email' => $membership->user->email, 'role' => $membership->role->value],
            $membership->school,
        );
    }

    /** The set-your-password email; also how an invitation is resent. */
    public function sendPasswordReset(SchoolMembership $membership): void
    {
        Password::sendResetLink(['email' => $membership->user->email]);

        AuditLog::record('school.password_reset_sent', $membership->user, ['email' => $membership->user->email], $membership->school);
    }

    private function guardLastAdmin(School $school, int $leavingUserId): void
    {
        $others = SchoolMembership::where('school_id', $school->id)
            ->where('role', MembershipRole::Admin)
            ->where('status', MembershipStatus::Active)
            ->where('user_id', '!=', $leavingUserId)
            ->exists();

        if (! $others) {
            throw ValidationException::withMessages(['admin' => __('api.last_admin')]);
        }
    }
}
