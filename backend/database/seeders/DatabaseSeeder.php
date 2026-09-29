<?php

namespace Database\Seeders;

use App\Models\School;
use App\Models\User;
use App\Tenancy\TenantContext;
use Database\Seeders\Demo\DemoSeeder;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Model events stay on (no WithoutModelEvents): BelongsToSchool fills
        // school_id on create. The default school comes from the step 1
        // migration. See docs/multi-tenancy.md.
        app(TenantContext::class)->set(School::query()->oldest('id')->firstOrFail());

        $this->call(RolePermissionSeeder::class);
        $this->call(SettingSeeder::class);
        $this->call(StageSeeder::class);
        $this->call(GradeSeeder::class);
        $this->call(ClassroomSeeder::class);
        $this->call(BloodTypeSeeder::class);
        $this->call(ReligionSeeder::class);
        $this->call(NationalitySeeder::class);
        $this->call(GovernorateSeeder::class);
        $this->call(AcademicYearSeeder::class);
        $this->call(SubjectSeeder::class);
        $this->call(TeacherSeeder::class);
        $this->call(ClassroomSubjectTeacherSeeder::class);
        $this->call(StudentSeeder::class);

        // User::factory(10)->create();

        $admin = User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

        $admin->assignRole('admin');
        // Demo only: in a real deployment use `php artisan platform:admin {email}`.
        $admin->forceFill(['is_platform_admin' => true])->save();

        // A plain registered account: no school, no roles, none of the
        // admin/parent/student territory. See docs/demo-accounts.md.
        User::factory()->create([
            'name' => 'Demo User',
            'email' => 'user@example.com',
        ]);

        $this->call(SchoolMembershipSeeder::class);

        // Activity on every page (docs/demo-seeder-plan.md). Never in
        // production by accident: local/testing, or SEED_DEMO=true.
        if (app()->environment('local', 'testing') || filter_var(env('SEED_DEMO', false), FILTER_VALIDATE_BOOL)) {
            $this->call(DemoSeeder::class);
        }
    }
}
