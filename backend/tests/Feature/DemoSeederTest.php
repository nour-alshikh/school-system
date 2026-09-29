<?php

namespace Tests\Feature;

use App\Enums\FeeChargeStatus;
use App\Enums\SchoolSource;
use App\Models\Attendance;
use App\Models\CalendarEvent;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\FeeCharge;
use App\Models\FeePayment;
use App\Models\Graduation;
use App\Models\LibraryResource;
use App\Models\Meeting;
use App\Models\Post;
use App\Models\Promotion;
use App\Models\School;
use App\Models\Setting;
use App\Models\Student;
use App\Models\User;
use App\Tenancy\TenantContext;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * docs/demo-seeder-plan.md, "Done when": the full seed runs and every page
 * has something to show, at both schools.
 */
class DemoSeederTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Storage::fake('local');
        Notification::fake();

        $this->seed(DatabaseSeeder::class);
    }

    public function test_it_seeds_two_schools_with_activity_at_both(): void
    {
        $this->assertSame(2, School::count());
        $this->assertSame(0, School::where('source', '!=', SchoolSource::Seed)->count());

        foreach (School::all() as $school) {
            app(TenantContext::class)->runAs($school, function () use ($school) {
                foreach ([Student::class, FeeCharge::class, FeePayment::class, Attendance::class, Exam::class,
                    ExamAttempt::class, CalendarEvent::class, Meeting::class, Post::class, LibraryResource::class] as $model) {
                    $this->assertGreaterThan(0, $model::count(), "{$model} at {$school->slug}");
                }

                $this->assertNotNull(Setting::currency());
                $this->assertNotNull(Setting::schoolDays());
            });
        }

        $this->assertSame(['EGP', 'USD'], School::orderBy('id')->get()
            ->map(fn (School $s) => app(TenantContext::class)->runAs($s, fn () => Setting::currency()))->all());
    }

    public function test_every_fee_status_appears_and_matches_its_payments(): void
    {
        // Per school: the payments subquery is scoped to the current school too.
        $charges = School::all()->flatMap(fn (School $school) => app(TenantContext::class)->runAs(
            $school,
            fn () => FeeCharge::withSum('payments', 'amount')->get(),
        ));

        foreach (FeeChargeStatus::cases() as $status) {
            $this->assertTrue($charges->contains('status', $status), "no {$status->value} charge");
        }

        foreach ($charges as $charge) {
            $paid = (float) $charge->payments_sum_amount;
            $expected = match (true) {
                $charge->status === FeeChargeStatus::Waived => FeeChargeStatus::Waived,
                $paid <= 0 => FeeChargeStatus::Unpaid,
                $paid < (float) $charge->amount_due => FeeChargeStatus::Partial,
                default => FeeChargeStatus::Paid,
            };
            $this->assertSame($expected, $charge->status);
        }
    }

    public function test_attendance_is_only_on_each_schools_school_days(): void
    {
        foreach (School::all() as $school) {
            app(TenantContext::class)->runAs($school, function () {
                $days = Setting::schoolDays();

                foreach (Attendance::distinct()->pluck('date') as $date) {
                    $this->assertContains(now()->parse($date)->dayOfWeek, $days);
                }
            });
        }
    }

    public function test_history_and_media_exist(): void
    {
        $this->assertGreaterThan(0, Promotion::withoutSchoolScope()->count());
        $this->assertSame(1, Graduation::withoutSchoolScope()->count());
        $this->assertGreaterThan(0, DB::table('media')->where('collection_name', 'attachments')->count());
        $this->assertGreaterThan(0, DB::table('media')->where('collection_name', 'avatar')->count());
        // Three library PDFs per school.
        $this->assertSame(6, DB::table('media')->where('collection_name', 'file')->count());
    }

    public function test_no_row_points_at_another_schools_records(): void
    {
        // The composite foreign keys already enforce this; spelled out for
        // the busiest tables.
        foreach (['fee_charges' => 'students', 'attendances' => 'students', 'exam_attempts' => 'students'] as $table => $parent) {
            $mismatched = DB::table($table)
                ->join($parent, "{$parent}.id", '=', "{$table}.student_id")
                ->whereColumn("{$parent}.school_id", '!=', "{$table}.school_id")
                ->count();
            $this->assertSame(0, $mismatched, $table);
        }
    }

    public function test_the_family_parent_sees_a_child_at_each_school(): void
    {
        $token = $this->postJson('/api/login', [
            'email' => 'family.parent@demo.school', 'password' => 'password', 'role' => 'parent',
            'school_id' => School::oldest('id')->value('id'),
        ])->assertOk()->json('token');

        $this->withToken($token)->getJson('/api/parent/children')
            ->assertOk()
            ->assertJsonCount(2, 'children');
    }

    public function test_the_demo_admin_can_sign_in_to_either_school(): void
    {
        $admin = User::where('email', 'test@example.com')->sole();

        $this->assertSame(2, $admin->memberships()->where('role', 'admin')->count());
        $this->assertSame(2, User::where('email', 'shared.teacher@demo.school')->sole()->memberships()->count());
    }
}
