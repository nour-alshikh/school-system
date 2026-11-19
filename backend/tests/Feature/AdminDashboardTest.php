<?php

namespace Tests\Feature;

use App\Enums\FeeChargeStatus;
use App\Enums\StudentStatus;
use App\Models\Attendance;
use App\Models\FeeCharge;
use App\Models\FeePayment;
use App\Models\School;
use App\Models\Setting;
use App\Models\Student;
use App\Tenancy\TenantContext;
use App\TypeScript\AdminDashboardType;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The admin dashboard's trend and attention data, checked against the demo
 * seed with independent queries.
 */
class AdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    private School $school;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Storage::fake('local');
        Notification::fake();
        $this->seed(DatabaseSeeder::class);

        $this->school = School::oldest('id')->firstOrFail();
        $this->token = $this->postJson('/api/login', [
            'email' => 'admin@demo.school', 'password' => 'password', 'role' => 'admin',
            'school_id' => $this->school->id,
        ])->assertOk()->json('token');
    }

    private function dashboard(): array
    {
        return $this->withToken($this->token)->getJson('/api/admin/dashboard')->assertOk()->json('dashboard');
    }

    private function inSchool(callable $fn): mixed
    {
        return app(TenantContext::class)->runAs($this->school, $fn);
    }

    public function test_the_series_have_one_entry_per_day_or_month(): void
    {
        $d = $this->dashboard();

        $this->assertCount(AdminDashboardType::TREND_DAYS, $d['attendance_trend']);
        $this->assertSame(today()->toDateString(), end($d['attendance_trend'])['date']);
        $this->assertCount(AdminDashboardType::MONTHS, $d['fees_by_month']);
        $this->assertSame(now()->format('Y-m'), end($d['fees_by_month'])['month']);
        $this->assertCount(AdminDashboardType::MONTHS, $d['enrollments_by_month']);
    }

    public function test_the_attendance_trend_matches_the_records(): void
    {
        $d = $this->dashboard();

        $expected = $this->inSchool(fn () => Attendance::where('date', '>=', today()->subDays(AdminDashboardType::TREND_DAYS - 1)->toDateString())->count());
        $total = collect($d['attendance_trend'])->sum(fn ($day) => $day['present'] + $day['late'] + $day['absent'] + $day['excused']);

        $this->assertSame($expected, $total);
        $this->assertGreaterThan(0, $total, 'the demo seed should have recent attendance');
    }

    public function test_fees_by_month_matches_payments(): void
    {
        $d = $this->dashboard();

        $since = now()->startOfMonth()->subMonths(AdminDashboardType::MONTHS - 1)->toDateString();
        $expected = $this->inSchool(fn () => (float) FeePayment::where('paid_at', '>=', $since)->sum('amount'));

        $this->assertEqualsWithDelta($expected, collect($d['fees_by_month'])->sum(fn ($m) => (float) $m['collected']), 0.01);
    }

    public function test_students_by_stage_adds_up_to_active_students_with_a_stage(): void
    {
        $d = $this->dashboard();

        $expected = $this->inSchool(fn () => Student::where('status', StudentStatus::Active)->whereNotNull('stage_id')->count());

        $this->assertSame($expected, collect($d['students_by_stage'])->sum('count'));
        $this->assertNotEmpty($d['students_by_stage'][0]['name_ar']);
    }

    public function test_overdue_balances_are_largest_first_and_match_the_charges(): void
    {
        $d = $this->dashboard();

        $owed = $this->inSchool(fn () => FeeCharge::whereIn('status', [FeeChargeStatus::Unpaid, FeeChargeStatus::Partial])
            ->withSum('payments', 'amount')->get()
            ->groupBy('student_id')
            ->map(fn ($c) => $c->sum(fn ($x) => max(0, (float) $x->amount_due - (float) $x->payments_sum_amount)))
            ->filter(fn ($v) => $v > 0));

        $this->assertSame($owed->count(), $d['overdue_students_count']);
        $amounts = collect($d['top_overdue'])->pluck('outstanding')->map(fn ($a) => (float) $a)->all();
        $sorted = $amounts;
        rsort($sorted);
        $this->assertSame($sorted, $amounts);
        if ($owed->isNotEmpty()) {
            $this->assertEqualsWithDelta($owed->max(), $amounts[0], 0.01);
        }
    }

    public function test_recent_activity_is_newest_first_and_capped(): void
    {
        $activity = $this->dashboard()['recent_activity'];

        $this->assertNotEmpty($activity);
        $this->assertLessThanOrEqual(8, count($activity));
        $times = array_column($activity, 'at');
        $sorted = $times;
        rsort($sorted);
        $this->assertSame($sorted, $times);
        $this->assertContains($activity[0]['type'], ['payment', 'student', 'exam']);
    }

    public function test_marking_a_classroom_removes_it_from_the_unmarked_list(): void
    {
        // Make today a school day and clear one classroom's attendance for it.
        $classroomId = $this->inSchool(function () {
            Setting::updateOrCreate(['key' => 'school_days'], ['value' => '0,1,2,3,4,5,6']);
            $classroomId = Student::where('status', StudentStatus::Active)->whereNotNull('classroom_id')->value('classroom_id');
            Attendance::where('classroom_id', $classroomId)->whereDate('date', today())->delete();

            return $classroomId;
        });

        $d = $this->dashboard();
        $this->assertTrue($d['is_school_day']);
        $this->assertContains($classroomId, collect($d['classrooms_unmarked_today'])->pluck('id'));

        $this->inSchool(function () use ($classroomId) {
            $student = Student::where('classroom_id', $classroomId)->where('status', StudentStatus::Active)->firstOrFail();
            Attendance::create([
                'student_id' => $student->id,
                'classroom_id' => $classroomId,
                'academic_year_id' => $student->academic_year_id,
                'date' => today()->toDateString(),
                'status' => 'present',
            ]);
        });

        $ids = collect($this->dashboard()['classrooms_unmarked_today'])->pluck('id');
        $this->assertNotContains($classroomId, $ids);
    }
}
