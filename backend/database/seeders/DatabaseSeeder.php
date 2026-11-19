<?php

namespace Database\Seeders;

use App\Models\School;
use App\Models\User;
use App\Tenancy\TenantContext;
use Database\Seeders\Demo\DemoSeeder;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /** Admin of the default school (and of Hilltop, with the demo data). */
    public const ADMIN_EMAIL = 'admin@demo.school';

    /** Platform admin only: no school roles. */
    public const SYSTEM_ADMIN_EMAIL = 'system@demo.school';

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

        // The school admin and the system admin are separate accounts, as
        // they would be for real: the school admin runs a school, the
        // system admin runs the platform and only enters a school through
        // a recorded session. See docs/demo-accounts.md.
        $admin = User::factory()->create([
            'name' => 'Demo Admin',
            'email' => self::ADMIN_EMAIL,
        ]);
        $admin->assignRole('admin');

        // Demo only: in a real deployment use `php artisan platform:admin {email}`.
        User::factory()->create([
            'name' => 'System Admin',
            'email' => self::SYSTEM_ADMIN_EMAIL,
        ])->forceFill(['is_platform_admin' => true])->save();

        // A plain registered account: no school, no roles, none of the
        // admin/parent/student territory. See docs/demo-accounts.md.
        User::factory()->create([
            'name' => 'Demo User',
            'email' => 'user@example.com',
        ]);

        $this->call(SchoolMembershipSeeder::class);

        // Activity on every page (docs/demo-seeder-plan.md). Never in
        // production by accident: local/testing, SEED_DEMO=true, or a demo
        // deployment (DEMO_MODE, docs/demo-sandboxes.md).
        if (app()->environment('local', 'testing') || filter_var(env('SEED_DEMO', false), FILTER_VALIDATE_BOOL) || config('demo.enabled')) {
            $this->call(DemoSeeder::class);
        }
    }
}
