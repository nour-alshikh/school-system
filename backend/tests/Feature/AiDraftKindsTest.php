<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Models\Grade;
use App\Models\Plan;
use App\Models\School;
use App\Models\Stage;
use App\Models\Subject;
use App\Models\User;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Phase 3 of docs/ai-assistant-plan.md: the first wave of "Draft with AI"
 * kinds — exam questions, translation, calendar events, meetings and
 * library resources — each validated in PHP and gated like its form.
 */
class AiDraftKindsTest extends TestCase
{
    use RefreshDatabase;

    private School $school;

    private string $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        $this->school = School::query()->oldest('id')->firstOrFail();
        $this->admin = $this->token(MembershipRole::Admin);
        config(['services.openrouter.key' => 'test-key']);
    }

    public function test_exam_questions_are_cleaned_and_get_the_exams_subject_and_grade(): void
    {
        [$grade, $subject] = $this->gradeAndSubject();
        $this->reply([
            'title' => 'Fractions quiz',
            'instructions' => 'Choose one answer.',
            'questions' => [
                ['text' => 'What is 1/2 + 1/4?', 'options' => ['3/4', '2/6', '1/8'], 'correct' => 0, 'marks' => 2],
                ['text' => 'No right answer', 'options' => ['a', 'b'], 'correct' => 5],
                ['text' => 'One option', 'options' => ['only'], 'correct' => 0],
                ['text' => 'Object options', 'options' => [['text' => 'yes'], ['text' => 'no'], ''], 'correct' => 1, 'marks' => 500],
            ],
        ]);

        $this->draft('exam_questions', ['notes' => '2 MCQs on fractions', 'context' => ['subject_id' => $subject->id, 'grade_id' => $grade->id]])
            ->assertOk()
            ->assertExactJson(['draft' => [
                'title' => 'Fractions quiz',
                'instructions' => 'Choose one answer.',
                'questions' => [
                    ['text' => 'What is 1/2 + 1/4?', 'options' => ['3/4', '2/6', '1/8'], 'correct' => 0, 'marks' => 2],
                    ['text' => 'Object options', 'options' => ['yes', 'no'], 'correct' => 1, 'marks' => 1],
                ],
            ]]);

        Http::assertSent(fn ($r) => $r['messages'][1]['content'] === "Subject: Mathematics\nGrade: Grade 4\nRequest:\n2 MCQs on fractions");
    }

    public function test_exam_questions_need_usable_questions_and_this_schools_subject(): void
    {
        $this->reply(['questions' => [['text' => 'x', 'options' => ['a'], 'correct' => 0]]]);
        $this->draft('exam_questions')->assertStatus(502);

        $other = School::create(['name' => 'Other', 'slug' => 'other-school']);
        $foreign = app(TenantContext::class)->runAs($other, fn () => Subject::create(['name' => ['en' => 'Art', 'ar' => 'فن']]));
        $this->draft('exam_questions', ['notes' => 'x', 'context' => ['subject_id' => $foreign->id]])->assertJsonValidationErrors('context.subject_id');
    }

    public function test_each_kind_follows_its_forms_permission_and_plan(): void
    {
        Http::fake();
        $teacher = $this->token(MembershipRole::Teacher);
        $parent = $this->token(MembershipRole::Parent);

        $this->draft('exam_questions', [], $parent)->assertForbidden();
        $this->draft('meeting', [], $parent)->assertForbidden();
        $this->draft('library_resource', [], $parent)->assertForbidden();
        $this->draft('calendar_event', [], $teacher)->assertForbidden();

        $plan = Plan::create(['key' => 'no-modules', 'name' => 'No modules', 'features' => ['fees', 'ai']]);
        $this->school->update(['plan_id' => $plan->id]);
        foreach (['exam_questions', 'meeting', 'library_resource'] as $kind) {
            $this->draft($kind)->assertForbidden()->assertJsonPath('message', 'Not included in your plan.');
        }

        Http::assertNothingSent();
    }

    public function test_translation_goes_the_right_way(): void
    {
        $this->reply(['text' => 'الصف الرابع']);

        $this->draft('translate', ['notes' => 'Grade 4', 'context' => ['from' => 'en', 'what' => 'grade name']])
            ->assertOk()
            ->assertExactJson(['draft' => ['text' => 'الصف الرابع']]);
        Http::assertSent(fn ($r) => $r['messages'][1]['content'] === "Translate from English to Arabic (grade name):\nGrade 4");

        $this->draft('translate', ['notes' => 'x', 'context' => ['from' => 'fr']])->assertJsonValidationErrors('context.from');

        $this->reply(['text' => '']);
        $this->draft('translate', ['notes' => 'x', 'context' => ['from' => 'ar']])->assertStatus(502);
        $this->draft('translate', ['notes' => 'x', 'context' => ['from' => 'en']], $this->token(MembershipRole::Parent))->assertStatus(502);
    }

    public function test_a_calendar_event_keeps_only_a_real_nearby_date(): void
    {
        $nextWeek = now()->addWeek()->toDateString();
        $this->reply(['title' => 'Sports day', 'description' => 'Parents welcome.', 'date' => $nextWeek]);
        $this->draft('calendar_event', ['notes' => 'sports day next week'])
            ->assertOk()
            ->assertExactJson(['draft' => ['title' => 'Sports day', 'description' => 'Parents welcome.', 'date' => $nextWeek]]);
        Http::assertSent(fn ($r) => str_contains($r['messages'][0]['content'], 'Today is '.now()->format('l, Y-m-d')));

        foreach (['2026-02-30', now()->addYears(3)->toDateString(), 'next thursday', null] as $date) {
            $this->reply(['title' => 'X', 'date' => $date]);
            $this->draft('calendar_event')->assertOk()->assertJsonPath('draft.date', null)->assertJsonPath('draft.description', '');
        }
    }

    public function test_a_meeting_gets_an_agenda_and_a_checked_time(): void
    {
        $start = now()->addDays(2)->setTime(10, 0)->format('Y-m-d\TH:i');
        $this->reply(['title' => 'Maths revision', 'description' => "Revise for the exam.\n- Fractions", 'start_time' => $start, 'duration_minutes' => 45]);
        $this->draft('meeting', ['notes' => 'maths revision thursday 10am, 45 min'], $this->token(MembershipRole::Teacher))
            ->assertOk()
            ->assertJsonPath('draft.start_time', $start)
            ->assertJsonPath('draft.duration_minutes', 45);

        $this->reply(['title' => 'X', 'start_time' => now()->subDay()->format('Y-m-d\TH:i'), 'duration_minutes' => 2]);
        $this->draft('meeting')->assertOk()->assertJsonPath('draft.start_time', null)->assertJsonPath('draft.duration_minutes', null);
    }

    public function test_library_suggestions_come_only_from_the_options_offered(): void
    {
        [$grade, $subject] = $this->gradeAndSubject();
        [$otherGrade, $otherSubject] = app(TenantContext::class)->runAs($this->school, function () {
            $stage = Stage::create(['name' => ['en' => 'Secondary', 'ar' => 'الثانوية']]);

            return [Grade::create(['stage_id' => $stage->id, 'name' => ['en' => 'Grade 10', 'ar' => 'الصف العاشر']]), Subject::create(['name' => ['en' => 'Physics', 'ar' => 'الفيزياء']])];
        });
        $this->reply(['description' => 'Practice sheets.', 'grade_id' => $otherGrade->id, 'subject_ids' => [$subject->id, $otherSubject->id, 999]]);

        $this->draft('library_resource', ['notes' => 'worksheets', 'context' => [
            'title' => 'Fractions practice',
            'grade_options' => [$grade->id],
            'subject_options' => [$subject->id],
        ]])
            ->assertOk()
            ->assertExactJson(['draft' => ['description' => 'Practice sheets.', 'grade_id' => null, 'subject_ids' => [$subject->id]]]);

        Http::assertSent(fn ($r) => str_contains($r['messages'][1]['content'], 'Grades: {"'.$grade->id.'":"Grade 4"}')
            && str_contains($r['messages'][1]['content'], 'Title: Fractions practice'));
    }

    /** @return array{0: Grade, 1: Subject} */
    private function gradeAndSubject(): array
    {
        return app(TenantContext::class)->runAs($this->school, function () {
            $stage = Stage::create(['name' => ['en' => 'Primary', 'ar' => 'الابتدائية']]);

            return [
                Grade::create(['stage_id' => $stage->id, 'name' => ['en' => 'Grade 4', 'ar' => 'الصف الرابع']]),
                Subject::create(['name' => ['en' => 'Mathematics', 'ar' => 'الرياضيات']]),
            ];
        });
    }

    /** A fresh fake each time: a second Http::fake() would only add stubs behind the first. */
    private function reply(array $content): void
    {
        Http::swap(new Factory);
        Http::fake(['openrouter.ai/*' => Http::response(['choices' => [['message' => ['content' => json_encode($content, JSON_UNESCAPED_UNICODE)]]]])]);
    }

    private function draft(string $kind, array $body = [], ?string $token = null): TestResponse
    {
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->withToken($token ?? $this->admin)->postJson("/api/ai/draft/{$kind}", $body ?: ['notes' => 'x']);
    }

    private function token(MembershipRole $role): string
    {
        $user = User::factory()->create();
        app(TenantContext::class)->runAs($this->school, fn () => app(MembershipService::class)->grant($user, $role));
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->postJson('/api/login', ['email' => $user->email, 'password' => 'password', 'role' => $role->value])->json('token');
    }
}
