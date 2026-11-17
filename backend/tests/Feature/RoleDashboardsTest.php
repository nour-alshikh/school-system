<?php

namespace Tests\Feature;

use App\Enums\ExamAttemptStatus;
use App\Models\Attendance;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\LibraryResource;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use App\Tenancy\TenantContext;
use App\TypeScript\ParentChildType;
use App\TypeScript\StudentDashboardType;
use App\TypeScript\TeacherDashboardType;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The teacher, student and parent dashboards (docs/design-refresh-plan.md,
 * step 4), checked against the demo seed with independent queries.
 */
class RoleDashboardsTest extends TestCase
{
    use RefreshDatabase;

    private School $school;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Storage::fake('local');
        Notification::fake();
        $this->seed(DatabaseSeeder::class);

        $this->school = School::oldest('id')->firstOrFail();
    }

    private function logIn(string $email, string $role): string
    {
        return $this->postJson('/api/login', [
            'email' => $email, 'password' => 'password', 'role' => $role, 'school_id' => $this->school->id,
        ])->assertOk()->json('token');
    }

    private function inSchool(callable $fn): mixed
    {
        return app(TenantContext::class)->runAs($this->school, $fn);
    }

    /** @param  array<int, array{starts_at: string, all_day: bool}>  $agenda */
    private function assertAgendaSorted(array $agenda): void
    {
        $keys = array_map(fn ($i) => $i['all_day'] ? $i['starts_at'].'T00:00:00' : $i['starts_at'], $agenda);
        $sorted = $keys;
        sort($sorted);
        $this->assertSame($sorted, $keys);
    }

    public function test_the_teacher_dashboard(): void
    {
        $token = $this->logIn('mona.ali@teachers.demo', 'teacher');
        $d = $this->withToken($token)->getJson('/api/teacher/dashboard')->assertOk()->json('dashboard');
        $teacherUserId = User::where('email', 'mona.ali@teachers.demo')->value('id');

        // Every classroom once: ones with students first, then unmarked first;
        // today's counts from the records.
        $this->assertCount($d['classrooms_count'], $d['classrooms']);
        $order = array_map(fn ($c) => [$c['students_count'] === 0, $c['marked_today']], $d['classrooms']);
        $this->assertSame($order, collect($order)->sort()->values()->all(), 'classrooms with students, then unmarked, come first');
        $this->assertGreaterThan(0, $d['classrooms'][0]['students_count']);
        $marked = array_column($d['classrooms'], 'marked_today');
        $this->assertSame($d['attendance_marked_count'], count(array_filter($marked)));
        $this->assertSame($d['students_total'], array_sum(array_column($d['classrooms'], 'students_count')));
        $first = $d['classrooms'][0];
        $this->assertNotEmpty($first['subjects_ar']);
        $records = $this->inSchool(fn () => Attendance::where('classroom_id', $first['id'])->whereDate('date', today())->count());
        $this->assertSame($first['marked_today'], $records > 0);

        // Open exams: the teacher's own, published, not closed yet.
        foreach ($d['open_exams'] as $exam) {
            $this->assertSame('published', $exam['status']);
            $this->assertTrue(now()->lte($exam['closes_at']));
            $this->assertSame($teacherUserId, $this->inSchool(fn () => Exam::find($exam['id'])->created_by));
        }

        // Results: closed exams, oldest first, averages from the attempts.
        $this->assertNotEmpty($d['exam_results'], 'the demo seed should give this teacher closed exams');
        $this->assertLessThanOrEqual(TeacherDashboardType::RESULTS, count($d['exam_results']));
        $closes = array_column($d['exam_results'], 'closes_at');
        $this->assertSame($closes, collect($closes)->sort()->values()->all());
        foreach ($d['exam_results'] as $result) {
            $this->assertTrue(now()->gt($result['closes_at']));
            [$avg, $total] = $this->inSchool(fn () => [
                ExamAttempt::where('exam_id', $result['id'])->where('status', ExamAttemptStatus::Submitted)->avg('score'),
                Exam::find($result['id'])->questions()->sum('marks'),
            ]);
            $expected = $avg === null ? null : round($avg / $total * 100, 1);
            $this->assertEqualsWithDelta($expected, $result['average_percent'], 0.05);
        }

        $this->assertAgendaSorted($d['agenda']);
    }

    public function test_the_student_dashboard(): void
    {
        $token = $this->logIn('ali.hassan1.student@demo.school', 'student');
        $d = $this->withToken($token)->getJson('/api/student/dashboard')->assertOk()->json('dashboard');
        $student = $this->inSchool(fn () => Student::whereHas('user', fn ($q) => $q->where('email', 'ali.hassan1.student@demo.school'))->sole());

        // Score trend: the newest submitted attempts, oldest first, with percents.
        $attempts = $this->inSchool(fn () => ExamAttempt::where('student_id', $student->id)->where('status', ExamAttemptStatus::Submitted)->count());
        $this->assertCount(min($attempts, StudentDashboardType::TREND), $d['score_trend']);
        $this->assertGreaterThan(1, count($d['score_trend']), 'the demo seed should give a trend');
        $at = array_column($d['score_trend'], 'submitted_at');
        $this->assertSame($at, collect($at)->sort()->values()->all());
        foreach ($d['score_trend'] as $s) {
            $this->assertEqualsWithDelta($s['score'] / $s['total_marks'] * 100, $s['percent'], 0.05);
        }

        // Upcoming exams: not closed, not submitted, soonest first.
        foreach ($d['upcoming_exams'] as $exam) {
            $this->assertTrue(now()->lte($exam['closes_at']));
            $this->assertNotSame('submitted', $exam['attempt_status']);
        }

        // Library: newest for the student's grade.
        $expected = $this->inSchool(fn () => LibraryResource::where('grade_id', $student->grade_id)->latest('id')->take(3)->pluck('id')->all());
        $this->assertSame($expected, array_column($d['library_resources'], 'id'));

        $this->assertAgendaSorted($d['agenda']);
        foreach ($d['agenda'] as $item) {
            $this->assertTrue(today()->lte(substr($item['starts_at'], 0, 10)) || $item['kind'] === 'meeting');
        }
    }

    public function test_each_child_on_the_parent_dashboard_has_scores_and_an_agenda(): void
    {
        $token = $this->logIn('family.parent@demo.school', 'parent');
        $children = $this->withToken($token)->getJson('/api/parent/children')->assertOk()->json('children');

        $this->assertNotEmpty($children);
        foreach ($children as $child) {
            $this->assertNotEmpty($child['latest_scores'], 'the demo seed should give each child results');
            $this->assertLessThanOrEqual(ParentChildType::SCORES, count($child['latest_scores']));
            $at = array_column($child['latest_scores'], 'submitted_at');
            $this->assertSame($at, collect($at)->sort()->reverse()->values()->all(), 'newest first');
            $this->assertAgendaSorted($child['agenda']);
            foreach ($child['agenda'] as $item) {
                $this->assertContains($item['kind'], ['exam', 'event']);
            }
        }
    }
}
