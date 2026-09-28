<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
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

        $admin->assignRole('user');
        $admin->assignRole('admin');

        // Base "user" role, no extra permissions — a plain registered account
        // with none of the admin/parent/student territory. See docs/demo-accounts.md.
        $plainUser = User::factory()->create([
            'name' => 'Demo User',
            'email' => 'user@example.com',
        ]);

        $plainUser->assignRole('user');

        $this->call(SchoolMembershipSeeder::class);
        $this->call(BackfillSchoolIdSeeder::class);
    }
}
