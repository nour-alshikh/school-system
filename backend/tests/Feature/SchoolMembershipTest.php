<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Enums\MembershipStatus;
use App\Models\School;
use App\Models\SchoolMembership;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\SchoolMembershipSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SchoolMembershipTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    public function test_migrations_create_one_default_school(): void
    {
        $this->assertSame(1, School::count());
        $this->assertSame('active', School::first()->status->value);
    }

    public function test_backfill_migration_gives_existing_users_a_membership_per_school_role(): void
    {
        $teacherAndParent = User::factory()->create();
        $teacherAndParent->assignRole('teacher');
        $teacherAndParent->assignRole('parent');

        $plainUser = User::factory()->create();
        $plainUser->assignRole('user');

        // Re-run the backfill as if these users existed before the upgrade.
        DB::table('schools')->delete();
        $migration = require database_path('migrations/2026_09_28_090002_create_default_school_and_backfill_memberships.php');
        $migration->up();

        $school = School::sole();

        $this->assertEqualsCanonicalizing(
            ['teacher', 'parent'],
            $teacherAndParent->memberships()->pluck('role')->map->value->all(),
        );
        $this->assertTrue($teacherAndParent->memberships->every(
            fn (SchoolMembership $m) => $m->school_id === $school->id && $m->status === MembershipStatus::Active,
        ));
        $this->assertSame(0, $plainUser->memberships()->count());
    }

    public function test_seeder_creates_memberships_from_roles_and_is_idempotent(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $admin->assignRole('user');

        $this->seed(SchoolMembershipSeeder::class);
        $this->seed(SchoolMembershipSeeder::class);

        $this->assertSame(1, $admin->memberships()->count());
        $this->assertSame(MembershipRole::Admin, $admin->memberships()->first()->role);
    }

    public function test_user_can_belong_to_two_schools(): void
    {
        $user = User::factory()->create();
        $schoolA = School::first();
        $schoolB = School::create(['name' => 'Second School', 'slug' => 'second-school']);

        $user->memberships()->create(['school_id' => $schoolA->id, 'role' => MembershipRole::Teacher]);
        $user->memberships()->create(['school_id' => $schoolB->id, 'role' => MembershipRole::Parent]);

        $this->assertEqualsCanonicalizing(
            [$schoolA->id, $schoolB->id],
            $user->schools()->pluck('schools.id')->all(),
        );
    }

    public function test_same_role_at_same_school_is_rejected(): void
    {
        $user = User::factory()->create();
        $school = School::first();

        $user->memberships()->create(['school_id' => $school->id, 'role' => MembershipRole::Teacher]);

        $this->expectException(QueryException::class);
        $user->memberships()->create(['school_id' => $school->id, 'role' => MembershipRole::Teacher]);
    }
}
