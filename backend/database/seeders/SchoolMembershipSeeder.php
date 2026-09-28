<?php

namespace Database\Seeders;

use App\Enums\MembershipRole;
use App\Enums\MembershipStatus;
use App\Models\School;
use App\Models\SchoolMembership;
use App\Models\User;
use App\Tenancy\TenantContext;
use Illuminate\Database\Seeder;

/**
 * The default school is created by the backfill migration, before any
 * users exist on a fresh install — so seeded users get their memberships
 * here, from their spatie roles, the same way the migration backfills them.
 * Run last in DatabaseSeeder.
 */
class SchoolMembershipSeeder extends Seeder
{
    public function run(): void
    {
        $school = School::query()->oldest('id')->firstOrFail();
        $roles = array_column(MembershipRole::cases(), 'value');

        // Roles are assigned per school (spatie teams), so read them as it.
        app(TenantContext::class)->runAs($school, function () use ($school, $roles) {
            User::query()->with('roles')->each(function (User $user) use ($school, $roles) {
                foreach ($user->roles->pluck('name')->intersect($roles) as $role) {
                    SchoolMembership::firstOrCreate(
                        ['user_id' => $user->id, 'school_id' => $school->id, 'role' => $role],
                        ['status' => MembershipStatus::Active, 'started_at' => $user->created_at],
                    );
                }
            });
        });
    }
}
