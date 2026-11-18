<?php

namespace Tests\Feature;

use App\Enums\AttendanceStatus;
use App\Models\AiUsage;
use App\Models\Attendance;
use App\Models\FeeCharge;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use App\Tenancy\TenantContext;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Phase 7 of docs/ai-assistant-plan.md: drafts built from school data — a
 * student progress note, the weekly summary — gated by assistant_data like
 * the assistant's lookups, plus the SEO draft (only what the admin typed).
 * Runs on the demo seed.
 */
class AiWaveTwoTest extends TestCase
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
        config([
            'services.openrouter.key' => 'test-key',
            'ai.caps' => ['user_daily' => 100, 'school_daily' => 1000],
        ]);
    }

    public function test_seo_draft_uses_the_form_details_and_is_trimmed(): void
    {
        $admin = $this->login('test@example.com', 'admin');
        $this->replies(['meta_title' => str_repeat('T', 90), 'meta_description' => 'A caring bilingual school in Maadi. Book a visit.']);

        $this->as($admin)->postJson('/api/ai/draft/seo', [
            'notes' => 'bilingual, small classes',
            'context' => ['school_name' => 'Nile Valley School', 'tagline' => 'Learning together', 'address' => 'Maadi, Cairo'],
        ])->assertOk()
            ->assertJsonPath('draft.meta_title', str_repeat('T', 70))
            ->assertJsonPath('draft.meta_description', 'A caring bilingual school in Maadi. Book a visit.');

        $sent = Http::recorded()[0][0]['messages'][1]['content'];
        $this->assertStringContainsString('School name: Nile Valley School', $sent);
        $this->assertStringContainsString("Notes:\nbilingual, small classes", $sent);

        // Works without assistant_data (nothing from the school's records goes out).
        $this->assertSame('draft.seo', AiUsage::sole()->feature);
    }

    public function test_seo_draft_needs_manage_settings(): void
    {
        Http::fake();
        $teacher = $this->login('mona.ali@teachers.demo', 'teacher');

        $this->as($teacher)->postJson('/api/ai/draft/seo', ['notes' => 'x'])->assertForbidden();
        Http::assertNothingSent();
    }

    public function test_progress_note_is_off_until_the_school_lets_ai_read_its_data(): void
    {
        Http::fake();
        $admin = $this->login('test@example.com', 'admin');
        $student = $this->inSchool(fn () => Student::firstOrFail());

        $this->as($admin)->getJson('/api/user')->assertJsonPath('user.ai_reads_data', false);
        $this->as($admin)->postJson('/api/ai/draft/progress_note', ['context' => ['student_id' => $student->id]])
            ->assertForbidden()
            ->assertJsonPath('message', __('api.ai_school_data_off'));
        Http::assertNothingSent();

        $this->enableData($admin);
        $this->as($admin)->getJson('/api/user')->assertJsonPath('user.ai_reads_data', true);
    }

    public function test_progress_note_sends_the_students_records_without_fees(): void
    {
        $admin = $this->login('test@example.com', 'admin');
        $this->enableData($admin);
        $student = $this->inSchool(function () {
            $student = Student::whereHas('feeCharges')->firstOrFail();
            Attendance::where('student_id', $student->id)->delete();
            Attendance::create([
                'student_id' => $student->id,
                'classroom_id' => $student->classroom_id,
                'date' => today()->subDay()->toDateString(),
                'academic_year_id' => $student->academic_year_id,
                'status' => AttendanceStatus::Absent,
            ]);

            return $student;
        });
        $this->replies(['note' => 'Dear parents, things are going well.']);

        // No notes needed: the records are enough.
        $this->as($admin)->postJson('/api/ai/draft/progress_note', ['context' => ['student_id' => $student->id, 'language' => 'ar']])
            ->assertOk()
            ->assertExactJson(['draft' => ['note' => 'Dear parents, things are going well.']]);

        $request = Http::recorded()[0][0];
        $this->assertStringContainsString('Modern Standard Arabic', $request['messages'][0]['content']);
        preg_match('#<student-records>\s*(.*?)\s*</student-records>#s', $request['messages'][1]['content'], $m);
        $records = json_decode($m[1], true);

        $this->assertSame($student->getTranslation('name', 'ar'), $records['name']);
        $this->assertSame(1, $records['attendance_last_30_days']['absent']);
        $this->assertArrayNotHasKey('fees', $records);
        $this->assertSame('draft.progress_note', AiUsage::sole()->feature);
    }

    public function test_progress_note_only_for_students_the_user_may_see(): void
    {
        Http::fake();
        $admin = $this->login('test@example.com', 'admin');
        $this->enableData($admin);
        $teacher = $this->login('mona.ali@teachers.demo', 'teacher');

        [$mine, $other] = $this->inSchool(function () {
            $classrooms = User::where('email', 'mona.ali@teachers.demo')->firstOrFail()->teacher->classroomSubjects()->pluck('classroom_id');

            return [
                Student::whereIn('classroom_id', $classrooms)->firstOrFail(),
                Student::whereNotIn('classroom_id', $classrooms)->firstOrFail(),
            ];
        });

        $this->as($teacher)->postJson('/api/ai/draft/progress_note', ['context' => ['student_id' => $other->id]])->assertForbidden();
        $this->as($admin)->postJson('/api/ai/draft/progress_note', ['context' => ['student_id' => 999999]])->assertForbidden();
        $this->as($admin)->postJson('/api/ai/draft/progress_note', ['context' => []])->assertJsonValidationErrors('context.student_id');
        Http::assertNothingSent();

        $this->replies(['note' => 'Hello.']);
        $this->as($teacher)->postJson('/api/ai/draft/progress_note', ['context' => ['student_id' => $mine->id]])->assertOk();

        $parent = $this->login('ali.hassan1.parent@demo.school', 'parent');
        $this->as($parent)->postJson('/api/ai/draft/progress_note', ['context' => ['student_id' => $mine->id]])->assertForbidden();
    }

    public function test_weekly_summary_shows_numbers_and_writes_only_with_school_data_on(): void
    {
        Http::fake();
        Cache::flush();
        $admin = $this->login('test@example.com', 'admin');

        $payments = $this->inSchool(fn () => FeeCharge::first()?->payments()->create(['amount' => 250, 'paid_at' => today()->toDateString(), 'method' => 'cash']));

        $show = $this->as($admin)->getJson('/api/admin/weekly-summary')->assertOk()
            ->assertJsonPath('can_write', false)
            ->assertJsonPath('summary', null);
        $this->assertSame(today()->toDateString(), $show->json('facts.to'));
        $this->assertArrayHasKey('rate_percent', $show->json('facts.attendance'));
        if ($payments) {
            $this->assertGreaterThanOrEqual(1, $show->json('facts.payments.count'));
        }

        $this->as($admin)->postJson('/api/admin/weekly-summary')->assertForbidden();
        Http::assertNothingSent();

        $this->enableData($admin);
        $this->replies(['summary' => 'Attendance was steady this week.']);
        $this->as($admin)->postJson('/api/admin/weekly-summary')->assertOk()
            ->assertJsonPath('summary.text', 'Attendance was steady this week.');

        // The numbers went as data; the written summary is kept for the day.
        $this->assertStringContainsString('<numbers>', Http::recorded()[0][0]['messages'][1]['content']);
        $this->as($admin)->getJson('/api/admin/weekly-summary')
            ->assertJsonPath('can_write', true)
            ->assertJsonPath('summary.text', 'Attendance was steady this week.');
        Http::assertSentCount(1);
        $this->assertSame('weekly_summary', AiUsage::sole()->feature);
    }

    public function test_weekly_summary_is_for_admins(): void
    {
        $teacher = $this->login('mona.ali@teachers.demo', 'teacher');
        $this->as($teacher)->getJson('/api/admin/weekly-summary')->assertForbidden();
    }

    private function enableData(string $admin): void
    {
        $this->as($admin)->putJson('/api/settings', ['settings' => [['key' => 'assistant_data', 'value' => '1']]])->assertOk();
    }

    private function replies(array ...$replies): void
    {
        Http::swap(new Factory(app('events')));
        $sequence = Http::sequence();
        foreach ($replies as $reply) {
            $sequence->push(['model' => 'test/model', 'choices' => [['message' => ['content' => json_encode($reply)]]]]);
        }
        Http::fake(['openrouter.ai/*' => $sequence]);
    }

    private function login(string $email, string $role): string
    {
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->postJson('/api/login', [
            'email' => $email, 'password' => 'password', 'role' => $role, 'school_id' => $this->school->id,
        ])->assertOk()->json('token');
    }

    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->withToken($token);
    }

    private function inSchool(callable $fn): mixed
    {
        return app(TenantContext::class)->runAs($this->school, $fn);
    }
}
