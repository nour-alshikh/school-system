<?php

namespace Database\Seeders\Demo;

use App\Enums\AnnouncementLevel;
use App\Enums\SchoolSource;
use App\Enums\SchoolStatus;
use App\Models\Announcement;
use App\Models\AuditLog;
use App\Models\Plan;
use App\Models\PlatformSession;
use App\Models\School;
use App\Models\Setting;
use App\Models\User;
use App\Platform\SchoolLifecycle;
use App\Services\SchoolProvisioner;
use App\Tenancy\TenantContext;
use Carbon\CarbonInterface;
use Database\Seeders\DatabaseSeeder;

/**
 * The system admin's side of the demo: a third school that is suspended,
 * announcements (one live for everyone, one for the default school's
 * admins, one ended), and an audit trail with a finished visit to a school
 * — so Platform → Schools, Announcements, Audit and the school admin's
 * "System admin activity" page all have something to show.
 */
class PlatformDemoSeeder
{
    public const SUSPENDED_ADMIN_EMAIL = 'admin@riverside.demo';

    private User $system;

    public function __construct(private readonly DemoPeople $people) {}

    public function run(School $default, School $hilltop): void
    {
        $system = $this->system = User::where('email', DatabaseSeeder::SYSTEM_ADMIN_EMAIL)->firstOrFail();

        $this->audit('platform.signed_in', null, ['two_factor' => true], null, now()->subDays(9), platformWide: true);
        $this->audit('school.created', $hilltop, ['name' => $hilltop->name, 'slug' => $hilltop->slug, 'admin_email' => SecondSchoolSeeder::ADMIN_EMAIL], $hilltop, now()->subDays(9));
        $this->audit('school.plan_changed', $hilltop, ['from' => 'Unlimited', 'to' => 'Standard'], $hilltop, now()->subDays(8));

        $this->suspendedSchool();
        $this->visit($default, $system);
        $this->announcements($default, $system);
    }

    /** Signed up, then suspended: shows the status filter, the reason, and the reactivate button. */
    private function suspendedSchool(): School
    {
        $this->people->user('Riverside Admin', self::SUSPENDED_ADMIN_EMAIL);

        ['school' => $school] = app(SchoolProvisioner::class)->create('Riverside Academy', 'riverside', 'Riverside Admin', self::SUSPENDED_ADMIN_EMAIL);
        $school->update(['source' => SchoolSource::Seed, 'plan_id' => Plan::where('key', 'basic')->value('id')]);
        app(TenantContext::class)->runAs($school, fn () => Setting::where('key', 'currency')->update(['value' => 'EGP']));
        $this->audit('school.created', $school, ['name' => $school->name, 'slug' => $school->slug, 'admin_email' => self::SUSPENDED_ADMIN_EMAIL], $school, now()->subDays(6));

        app(SchoolLifecycle::class)->setStatus($school, SchoolStatus::Suspended, 'Subscription payment is overdue.');
        // Recorded with the request's user, and there is none here.
        AuditLog::where('action', 'school.suspended')->latest('id')->first()
            ?->forceFill(['actor_id' => $this->system->id, 'created_at' => now()->subDays(2)])->save();

        return $school;
    }

    /** A finished visit to the default school, with what was looked at and changed. */
    private function visit(School $school, User $system): void
    {
        $started = now()->subDays(3)->setTime(10, 15);

        $session = PlatformSession::create([
            'user_id' => $system->id,
            'school_id' => $school->id,
            'reason' => 'The admin asked for help setting up this term’s fees.',
            'started_at' => $started,
            'expires_at' => $started->copy()->addHour(),
            'ended_at' => $started->copy()->addMinutes(18),
        ]);

        $this->audit('platform.entered_school', $session, ['reason' => $session->reason], $school, $started);

        foreach ([
            [2, 'GET', 'api/fees', 200, null],
            [5, 'GET', 'api/fee-charges', 200, null],
            [11, 'PUT', 'api/settings', 200, ['settings']],
            [14, 'GET', 'api/students', 200, null],
        ] as [$minutes, $method, $path, $status, $fields]) {
            $this->audit('platform.request', $session, array_filter([
                'method' => $method, 'path' => "/{$path}", 'route' => $path, 'status' => $status, 'fields' => $fields,
            ]), $school, $started->copy()->addMinutes($minutes));
        }

        $this->audit('platform.exited_school', $session, [], $school, $started->copy()->addMinutes(18));
    }

    private function announcements(School $default, User $system): void
    {
        $rows = [
            [
                'title' => ['en' => 'Welcome to the demo', 'ar' => 'مرحبًا بك في النسخة التجريبية'],
                'body' => ['en' => 'Everything here is sample data. Change anything you like: your copy is yours alone and resets after a few hours.',
                    'ar' => 'كل ما هنا بيانات تجريبية. غيّر ما تشاء: نسختك خاصة بك وتعود لحالتها الأولى بعد بضع ساعات.'],
                'level' => AnnouncementLevel::Info, 'school_id' => null, 'audience' => null,
                'starts_at' => now()->subDays(5), 'ends_at' => null,
            ],
            [
                'title' => ['en' => 'Maintenance on Friday night', 'ar' => 'صيانة مساء الجمعة'],
                'body' => ['en' => 'The system may be slow for about 30 minutes from 11 pm. Nothing needs to be done on your side.',
                    'ar' => 'قد يكون النظام بطيئًا لمدة 30 دقيقة تقريبًا بدءًا من الساعة 11 مساءً. لا يلزمك فعل أي شيء.'],
                'level' => AnnouncementLevel::Warning, 'school_id' => $default->id, 'audience' => ['admin'],
                'starts_at' => now()->subDay(), 'ends_at' => now()->addDays(4),
            ],
            [
                'title' => ['en' => 'New: exam results for parents', 'ar' => 'جديد: نتائج الامتحانات لأولياء الأمور'],
                'body' => ['en' => 'Parents can now see their child’s exam results from the portal.',
                    'ar' => 'يمكن لأولياء الأمور الآن رؤية نتائج امتحانات أبنائهم من البوابة.'],
                'level' => AnnouncementLevel::Info, 'school_id' => null, 'audience' => ['parent'],
                'starts_at' => now()->subDays(30), 'ends_at' => now()->subDays(16),
            ],
        ];

        foreach ($rows as $row) {
            $announcement = Announcement::create([...$row, 'created_by' => $system->id]);
            $this->audit('announcement.created', $announcement, ['title' => $row['title']['en']], $announcement->school, $row['starts_at']);
        }
    }

    private function audit(string $action, $subject, array $details, ?School $school, CarbonInterface $at, bool $platformWide = false): void
    {
        $log = AuditLog::record($action, $subject, $details, $school, $this->system, $platformWide);
        $log->forceFill(['created_at' => $at])->save();
    }
}
