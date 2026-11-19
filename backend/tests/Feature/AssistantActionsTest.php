<?php

namespace Tests\Feature;

use App\Enums\StudentStatus;
use App\Models\AssistantMessage;
use App\Models\Attendance;
use App\Models\CalendarEvent;
use App\Models\Classroom;
use App\Models\Meeting;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use App\Services\Ai\Assistant\Lookup;
use App\Tenancy\TenantContext;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Phase 6 of docs/ai-assistant-plan.md: the assistant proposes actions
 * that never run by themselves — validated and resolved on the server
 * (names → ids among what the user may use), saved as a card the user
 * confirms through the normal endpoint or page. Runs on the demo seed.
 */
class AssistantActionsTest extends TestCase
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

    public function test_an_event_is_proposed_not_created_and_the_card_can_be_marked_done(): void
    {
        $admin = $this->login('admin@demo.school', 'admin');
        $events = $this->inSchool(fn () => CalendarEvent::count());
        $date = today()->addDays(9)->toDateString();

        $this->replies(['reply' => 'Here it is.', 'action' => 'create_event', 'fields' => ['title' => 'Sports day', 'date' => $date, 'extra' => 'dropped']]);
        $response = $this->ask($admin, "Add sports day on {$date}")
            ->assertOk()
            ->assertJsonPath('messages.1.content', 'Here it is.')
            ->assertJsonPath('messages.1.action', [
                'name' => 'create_event',
                'fields' => ['title' => 'Sports day', 'date' => $date, 'description' => null],
                'warnings' => [],
                'status' => 'proposed',
            ]);

        // Offered even without school data, and nothing was saved.
        $this->assertStringContainsString('create_event(', Http::recorded()[0][0]['messages'][0]['content']);
        $this->assertSame($events, $this->inSchool(fn () => CalendarEvent::count()));

        $id = $response->json('messages.1.id');
        $other = $this->login('admin@hilltop.demo', 'admin', School::where('id', '!=', $this->school->id)->value('id'));
        $this->as($other)->patchJson("/api/assistant/messages/{$id}/action", ['status' => 'done'])->assertNotFound();
        $this->as($admin)->patchJson("/api/assistant/messages/{$id}/action", ['status' => 'maybe'])->assertJsonValidationErrors('status');
        $this->as($admin)->patchJson("/api/assistant/messages/{$id}/action", ['status' => 'done'])
            ->assertOk()->assertJsonPath('message.action.status', 'done');
        $this->as($admin)->getJson('/api/assistant/conversation')->assertJsonPath('conversation.messages.1.action.status', 'done');
    }

    public function test_actions_the_user_cant_do_are_not_offered_and_not_proposed(): void
    {
        $teacher = $this->login('mona.ali@teachers.demo', 'teacher');

        $this->replies(['reply' => 'Done.', 'action' => 'create_event', 'fields' => ['title' => 'Trip', 'date' => today()->addDay()->toDateString()]]);
        $this->ask($teacher, 'Add a trip tomorrow')
            ->assertOk()
            ->assertJsonPath('messages.1.action', null)
            ->assertJsonPath('messages.1.content', "Done.\n\n".__('api.assistant_action_failed'));

        $system = Http::recorded()[0][0]['messages'][0]['content'];
        $this->assertStringNotContainsString('create_event(', $system);
        $this->assertStringContainsString('mark_attendance(', $system);
        $this->assertSame([['action' => 'create_event', 'ok' => false]], AssistantMessage::where('role', 'assistant')->sole()->tools);

        // Bad fields: the same.
        $this->replies(['action' => 'draft_exam', 'fields' => ['title' => 'No request']]);
        $this->ask($teacher, 'Make an exam')->assertOk()->assertJsonPath('messages.1.action', null);
    }

    public function test_attendance_is_matched_to_the_teachers_own_classroom_and_students(): void
    {
        $teacher = $this->login('mona.ali@teachers.demo', 'teacher');

        [$classroom, $student, $otherClassroom] = $this->inSchool(function () {
            $mine = User::where('email', 'mona.ali@teachers.demo')->firstOrFail()->teacher->classroomSubjects()->pluck('classroom_id');
            $classroom = Classroom::whereIn('id', $mine)->whereHas('students', fn ($q) => $q->where('status', StudentStatus::Active))->firstOrFail();

            return [
                $classroom,
                Student::where('classroom_id', $classroom->id)->where('status', StudentStatus::Active)->firstOrFail(),
                Classroom::whereNotIn('id', $mine)->firstOrFail(),
            ];
        });
        $name = $student->getTranslation('name', 'en');
        $label = $this->inSchool(fn () => Lookup::name($student));
        $records = $this->inSchool(fn () => Attendance::count());

        $this->replies(['reply' => 'Ready.', 'action' => 'mark_attendance', 'fields' => [
            'classroom' => $classroom->name,
            'exceptions' => [['student' => mb_strtoupper($name), 'status' => 'absent'], ['student' => 'Zebedee Nobody', 'status' => 'late']],
        ]]);

        $this->ask($teacher, "Everyone present in {$classroom->name} except {$name}")
            ->assertOk()
            ->assertJsonPath('messages.1.action.name', 'mark_attendance')
            ->assertJsonPath('messages.1.action.fields.classroom_id', $classroom->id)
            ->assertJsonPath('messages.1.action.fields.date', today()->toDateString())
            ->assertJsonPath('messages.1.action.fields.default_status', 'present')
            ->assertJsonPath('messages.1.action.fields.exceptions', [['student_id' => $student->id, 'name' => $label, 'status' => 'absent']])
            ->assertJsonPath('messages.1.action.warnings', ['student_not_found:Zebedee Nobody']);

        // Nothing was marked.
        $this->assertSame($records, $this->inSchool(fn () => Attendance::count()));

        // Another teacher's classroom: no proposal.
        $this->replies(['action' => 'mark_attendance', 'fields' => ['classroom' => $otherClassroom->name]]);
        $this->ask($teacher, "Mark {$otherClassroom->name}")->assertOk()->assertJsonPath('messages.1.action', null);

        // A future day: no proposal.
        $this->replies(['action' => 'mark_attendance', 'fields' => ['classroom' => $classroom->name, 'date' => today()->addDay()->toDateString()]]);
        $this->ask($teacher, 'Mark tomorrow')->assertOk()->assertJsonPath('messages.1.action', null);
    }

    public function test_a_meeting_resolves_classrooms_and_refuses_the_past(): void
    {
        $admin = $this->login('admin@demo.school', 'admin');
        $meetings = $this->inSchool(fn () => Meeting::count());
        $classrooms = $this->inSchool(fn () => Classroom::orderBy('id')->take(2)->get());
        $start = now()->addDays(3)->setTime(10, 0);

        $this->replies(['reply' => 'Set.', 'action' => 'schedule_meeting', 'fields' => [
            'title' => 'Revision',
            'classrooms' => [$classrooms[0]->name, $classrooms[1]->name, 'Room 404'],
            'start' => $start->format('Y-m-d H:i'),
            'duration_minutes' => 45,
        ]]);

        $response = $this->ask($admin, 'Schedule revision')->assertOk()
            ->assertJsonPath('messages.1.action.fields.classroom_ids', [$classrooms[0]->id, $classrooms[1]->id])
            ->assertJsonPath('messages.1.action.fields.start_time', $start->format('Y-m-d\TH:i'))
            ->assertJsonPath('messages.1.action.fields.duration_minutes', 45);
        $this->assertContains('classroom_not_found:Room 404', $response->json('messages.1.action.warnings'));
        $this->assertSame($meetings, $this->inSchool(fn () => Meeting::count()));

        $this->replies(['action' => 'schedule_meeting', 'fields' => [
            'title' => 'Late', 'classrooms' => [$classrooms[0]->name], 'start' => now()->subHour()->format('Y-m-d H:i'), 'duration_minutes' => 30,
        ]]);
        $this->ask($admin, 'Schedule it an hour ago')->assertOk()->assertJsonPath('messages.1.action', null);
    }

    public function test_an_exam_request_is_handed_to_the_exam_builder(): void
    {
        $teacher = $this->login('mona.ali@teachers.demo', 'teacher');

        $this->replies(['action' => 'draft_exam', 'fields' => ['request' => '10 questions on past simple', 'title' => 'Grammar quiz']]);
        $this->ask($teacher, 'Make a grammar quiz')
            ->assertOk()
            ->assertJsonPath('messages.1.content', __('api.assistant_action_ready'))
            ->assertJsonPath('messages.1.action.fields', ['request' => '10 questions on past simple', 'title' => 'Grammar quiz']);
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

    private function ask(string $token, string $message): TestResponse
    {
        return $this->as($token)->postJson('/api/assistant/messages', ['message' => $message, 'links' => []]);
    }

    private function login(string $email, string $role, ?int $schoolId = null): string
    {
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->postJson('/api/login', [
            'email' => $email, 'password' => 'password', 'role' => $role, 'school_id' => $schoolId ?? $this->school->id,
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
