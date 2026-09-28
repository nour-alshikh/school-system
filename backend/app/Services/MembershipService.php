<?php

namespace App\Services;

use App\Enums\MembershipRole;
use App\Enums\MembershipStatus;
use App\Enums\SchoolStatus;
use App\Models\SchoolMembership;
use App\Models\User;
use App\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Collection;

/**
 * The one place a user joins a school. The spatie role and the membership
 * are written together so they never drift apart. See
 * docs/multi-tenancy.md.
 */
class MembershipService
{
    public function __construct(private readonly TenantContext $context) {}

    /**
     * Give $user $role at the current school.
     */
    public function grant(User $user, MembershipRole $role): SchoolMembership
    {
        $user->assignRole($role->value);

        return SchoolMembership::firstOrCreate(
            ['user_id' => $user->id, 'school_id' => $this->context->id(), 'role' => $role],
            ['status' => MembershipStatus::Active, 'started_at' => now()],
        );
    }

    /**
     * Memberships $user can currently sign in with: active, at an active
     * school, optionally limited to one role.
     *
     * @return Collection<int, SchoolMembership>
     */
    public function usable(User $user, ?MembershipRole $role = null): Collection
    {
        return $user->memberships()
            ->active()
            ->when($role, fn ($q) => $q->where('role', $role))
            ->whereHas('school', fn ($q) => $q->where('status', SchoolStatus::Active))
            ->with('school')
            ->orderBy('id')
            ->get();
    }

    public function isUsable(SchoolMembership $membership): bool
    {
        return $membership->status === MembershipStatus::Active
            && $membership->school->status === SchoolStatus::Active;
    }

    /**
     * A Sanctum token bound to $membership, so every request made with it
     * acts as that school (see ResolveSchool). Null for a plain account
     * that belongs to no school.
     */
    public function issueToken(User $user, ?SchoolMembership $membership): string
    {
        $token = $user->createToken('spa');

        if ($membership) {
            $token->accessToken->forceFill(['school_membership_id' => $membership->id])->save();
        }

        return $token->plainTextToken;
    }
}
