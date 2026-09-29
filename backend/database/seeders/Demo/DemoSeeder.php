<?php

namespace Database\Seeders\Demo;

use App\Enums\SchoolSource;
use App\Models\School;
use App\Models\Setting;
use App\Models\User;
use App\Tenancy\TenantContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Realistic activity on top of the base seed, so every page has content
 * right after `migrate:fresh --seed`: a second school, people at both,
 * fees, attendance, exams, calendar, meetings, posts, library, photos and
 * history. Local/testing only (see DatabaseSeeder), fresh databases only.
 * See docs/demo-seeder-plan.md.
 */
class DemoSeeder extends Seeder
{
    /**
     * What each school's admin "chose" in settings (docs/demo-seeder-plan.md,
     * step 0), different per school so switching schools visibly changes
     * the currency, week and colour. Fee amounts are in that currency.
     */
    private const SCHOOLS = [
        'default' => [
            'currency' => 'EGP', 'school_days' => '0,1,2,3,4', 'primary_color' => '#0f766e',
            'fees' => ['tuition' => 15000, 'books' => 1200, 'bus' => 3000],
        ],
        'hilltop' => [
            'currency' => 'USD', 'school_days' => '1,2,3,4,5', 'primary_color' => '#7c3aed',
            'fees' => ['tuition' => 4500, 'books' => 300, 'bus' => 600],
        ],
    ];

    public function run(): void
    {
        // One transaction: all or nothing, and far faster on SQLite, where
        // every statement outside one is its own committed write.
        DB::transaction(fn () => $this->seed());
    }

    private function seed(): void
    {
        // Same names, amounts and dates on every fresh seed.
        fake()->seed(2026);

        $context = app(TenantContext::class);
        $people = app(DemoPeople::class);

        $default = School::query()->oldest('id')->firstOrFail();
        $default->update(['source' => SchoolSource::Seed]);
        $platformAdmin = User::where('email', 'test@example.com')->firstOrFail();

        $hilltop = (new SecondSchoolSeeder($people))->run($platformAdmin);
        (new CrossSchoolPeopleSeeder($people))->run($default, $hilltop);

        // Before fees and attendance, so those use the students' final classrooms.
        $context->runAs($default, fn () => (new HistoryDemoSeeder($people))->run($platformAdmin));

        $admins = [
            'default' => $platformAdmin,
            'hilltop' => User::where('email', SecondSchoolSeeder::ADMIN_EMAIL)->firstOrFail(),
        ];

        foreach (['default' => $default, 'hilltop' => $hilltop] as $key => $school) {
            $config = self::SCHOOLS[$key];
            $admin = $admins[$key];

            $context->runAs($school, function () use ($config, $admin) {
                foreach (['currency', 'school_days', 'primary_color'] as $setting) {
                    Setting::where('key', $setting)->update(['value' => $config[$setting]]);
                }

                (new FeeDemoSeeder)->run($admin, $config['fees']);
                (new AttendanceDemoSeeder)->run($admin);
                (new ExamDemoSeeder)->run($admin);
                (new CalendarDemoSeeder)->run($admin);
                (new ContentDemoSeeder)->run($admin);
                (new PhotoDemoSeeder)->studentPhotos();
            });
        }

        (new PhotoDemoSeeder)->avatars([
            $platformAdmin,
            User::where('email', 'mona.ali@teachers.demo')->first(),
            User::where('email', CrossSchoolPeopleSeeder::FAMILY_PARENT_EMAIL)->first(),
        ]);
    }
}
