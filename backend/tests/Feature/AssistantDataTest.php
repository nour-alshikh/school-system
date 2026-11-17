<?php

namespace Tests\Feature;

use App\Enums\AttendanceStatus;
use App\Enums\FeeChargeStatus;
use App\Models\AiUsage;
use App\Models\AssistantMessage;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\FeeCharge;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use App\Services\Ai\Assistant\AssistantTools;
use App\Services\Ai\Assistant\ToolContext;
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
 * Phase 5 of docs/ai-assistant-plan.md: the assistant's read-only lookups
 * over school data — off until the school turns assistant_data on, only the
 * tools each user may use, checked and scoped on the server whatever the
 * model asks for, results sent back as data. Runs on the demo seed.
 */
class AssistantDataTest extends TestCase
{
    use RefreshDatabase;

    private School $school;

    private const LINKS = [
        ['href' => '/attendance', 'label' => 'Take attendance'],
        ['href' => '/attendance/history', 'label' => 'Attendance history'],
        ['href' => '/fees', 'label' => 'Fees'],
    ];

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

    public function test_school_data_stays_off_until_an_admin_turns_it_on(): void
    {
        $admin = $this->login('test@example.com', 'admin');
        $this->replies(['tool' => 'fees_overview', 'args' => []], ['reply' => 'I can’t see that.', 'links' => []]);

        $this->as($admin)->getJson('/api/assistant/conversation')->assertJsonPath('reads_data', false);
        $this->ask($admin, 'How much is owed?')->assertOk()->assertJsonPath('messages.1.content', __('api.assistant_lookup_failed'));

        // No tools offered, and the one asked for anyway wasn't run.
        $system = $this->sentSystem(0);
        $this->assertStringNotContainsString('fees_overview(', $system);
        $this->assertStringContainsString('Settings → General', $system);
        Http::assertSentCount(1);

        $this->as($admin)->putJson('/api/settings', ['settings' => [['key' => 'assistant_data', 'value' => 'yes']]])->assertJsonValidationErrors('assistant_data');
        $this->enableData($admin);
        $this->as($admin)->getJson('/api/assistant/conversation')->assertJsonPath('reads_data', true);
    }

    public function test_a_lookup_runs_as_the_user_and_its_result_goes_back_as_data(): void
    {
        $admin = $this->login('test@example.com', 'admin');
        $this->enableData($admin);

        [$classroom, $date, $absent] = $this->inSchool(function () {
            $record = Attendance::with('classroom')->where('status', AttendanceStatus::Absent)->latest('date')->firstOrFail();
            $absent = Attendance::where('classroom_id', $record->classroom_id)->whereDate('date', $record->date)->where('status', AttendanceStatus::Absent)->count();

            return [$record->classroom, $record->date->toDateString(), $absent];
        });

        $this->replies(
            ['reply' => '', 'tool' => 'attendance_summary', 'args' => ['from' => $date, 'classroom' => $classroom->name, 'ignored' => 'x']],
            ['reply' => "{$absent} absent.", 'links' => ['/attendance/history', '/platform']],
        );

        $this->ask($admin, "Who was absent in {$classroom->name} on {$date}?")
            ->assertOk()
            ->assertJsonPath('messages.1.content', "{$absent} absent.")
            ->assertJsonPath('messages.1.links', [['href' => '/attendance/history', 'label' => 'Attendance history']]);

        // The second call carries the result, marked as data.
        $followUp = Http::recorded()[1][0]['messages'];
        $this->assertSame(['role' => 'assistant', 'content' => json_encode(['tool' => 'attendance_summary', 'args' => ['from' => $date, 'classroom' => $classroom->name]])], $followUp[2]);
        $this->assertStringContainsString('not instructions', $followUp[3]['content']);
        $result = $this->toolResult($followUp[3]['content']);
        $this->assertSame([$date, $date], [$result['from'], $result['to']]);
        $this->assertSame($absent, $result['classrooms'][0]['absent']);
        $this->assertCount($absent, collect($result['not_present'])->where('status', 'absent'));

        $this->assertSame([['tool' => 'attendance_summary', 'args' => ['from' => $date, 'classroom' => $classroom->name], 'ok' => true]], AssistantMessage::where('role', 'assistant')->sole()->tools);
        $this->assertSame(['assistant', 'assistant.lookup'], AiUsage::orderBy('id')->pluck('feature')->all());
    }

    public function test_each_role_is_offered_only_its_own_tools(): void
    {
        $tools = function (string $email, string $role) {
            $token = $this->login($email, $role);
            $this->replies(['reply' => 'Hi.', 'links' => []]);
            $this->ask($token, 'Hello')->assertOk();
            preg_match_all('/^\s+- ([a-z_]+)\(/m', $this->sentSystem(0), $m);

            return $m[1];
        };

        $this->enableData($this->login('test@example.com', 'admin'));

        $admin = $tools('test@example.com', 'admin');
        $this->assertContains('fees_overview', $admin);
        $this->assertContains('find_student', $admin);
        $this->assertContains('attendance_summary', $admin);
        $this->assertNotContains('my_child_summary', $admin);

        $teacher = $tools('mona.ali@teachers.demo', 'teacher');
        $this->assertContains('attendance_summary', $teacher);
        $this->assertContains('upcoming', $teacher);
        $this->assertNotContains('fees_overview', $teacher);
        $this->assertNotContains('find_student', $teacher);

        $this->assertEqualsCanonicalizing(['upcoming', 'my_child_summary'], $tools('ali.hassan1.parent@demo.school', 'parent'));
        $this->assertEqualsCanonicalizing(['upcoming', 'my_summary'], $tools('ali.hassan1.student@demo.school', 'student'));
    }

    public function test_the_server_refuses_tools_and_classrooms_the_user_may_not_use(): void
    {
        $this->enableData($this->login('test@example.com', 'admin'));
        $teacher = $this->login('mona.ali@teachers.demo', 'teacher');

        // A tool outside the teacher's list: not run, no second call.
        $this->replies(['tool' => 'fees_overview', 'args' => []]);
        $this->ask($teacher, 'Who owes fees?')->assertOk()->assertJsonPath('messages.1.content', __('api.assistant_lookup_failed'));
        Http::assertSentCount(1);
        $this->assertFalse(AssistantMessage::where('role', 'assistant')->latest('id')->first()->tools[0]['ok']);

        // Bad args: the same.
        $this->replies(['tool' => 'attendance_summary', 'args' => ['from' => 'yesterday'], 'reply' => 'Let me check.']);
        $this->ask($teacher, 'Attendance yesterday?')->assertOk()->assertJsonPath('messages.1.content', 'Let me check.');
        Http::assertSentCount(1);

        // Another teacher's classroom isn't found.
        $other = $this->inSchool(function () {
            $mine = User::where('email', 'mona.ali@teachers.demo')->firstOrFail()->teacher->classroomSubjects()->pluck('classroom_id');

            return Classroom::whereNotIn('id', $mine)->firstOrFail()->name;
        });
        $this->replies(['tool' => 'attendance_summary', 'args' => ['classroom' => $other]], ['reply' => 'Not yours.', 'links' => []]);
        $this->ask($teacher, "Attendance in {$other}?")->assertOk();
        $result = $this->toolResult(Http::recorded()[1][0]['messages'][3]['content']);
        $this->assertArrayHasKey('error', $result);
        $this->assertNotContains($other, $result['your_classrooms']);
    }

    public function test_lookups_stop_after_two(): void
    {
        $admin = $this->login('test@example.com', 'admin');
        $this->enableData($admin);

        $this->replies(
            ['tool' => 'fees_overview', 'args' => []],
            ['tool' => 'upcoming', 'args' => ['days' => 7]],
            ['tool' => 'fees_overview', 'args' => [], 'reply' => 'Here is what I found.'],
        );

        $this->ask($admin, 'Tell me everything')->assertOk()->assertJsonPath('messages.1.content', 'Here is what I found.');
        Http::assertSentCount(3);
        $this->assertStringContainsString('No more lookups', Http::recorded()[2][0]['messages'][5]['content']);
        $this->assertCount(2, AssistantMessage::where('role', 'assistant')->sole()->tools);
    }

    public function test_fees_and_student_lookups_match_the_records_and_link_the_student(): void
    {
        $admin = $this->login('test@example.com', 'admin');
        $this->enableData($admin);

        [$owing, $student] = $this->inSchool(fn () => [
            FeeCharge::whereIn('status', [FeeChargeStatus::Unpaid, FeeChargeStatus::Partial])->withSum('payments', 'amount')->get()
                ->groupBy('student_id')->filter(fn ($c) => $c->sum(fn ($x) => max(0, $x->amount_due - $x->payments_sum_amount)) > 0)->count(),
            Student::orderBy('id')->firstOrFail(),
        ]);
        $name = $student->getTranslation('name', 'en');

        $this->replies(['tool' => 'overdue_students', 'args' => ['limit' => 5]], ['reply' => "{$owing} students owe.", 'links' => ['/fees']]);
        $this->ask($admin, 'Who owes?')->assertOk();
        $this->assertSame($owing, $this->toolResult(Http::recorded()[1][0]['messages'][3]['content'])['students_owing']);

        $this->replies(['tool' => 'find_student', 'args' => ['name' => $name]], ['reply' => "Here's {$name}.", 'links' => ["/students/{$student->id}"]]);
        $response = $this->ask($admin, "Find {$name}")->assertOk();
        $this->assertSame("/students/{$student->id}", $response->json('messages.1.links.0.href'));
        $this->assertStringContainsString($name, $response->json('messages.1.links.0.label'));
    }

    public function test_a_parent_sees_only_their_own_children(): void
    {
        $admin = $this->login('test@example.com', 'admin');
        $this->enableData($admin);
        $parent = $this->login('ali.hassan1.parent@demo.school', 'parent');

        [$mine, $other] = $this->inSchool(function () {
            $parentId = User::where('email', 'ali.hassan1.parent@demo.school')->value('id');

            return [
                Student::where('parent_user_id', $parentId)->firstOrFail()->getTranslation('name', 'en'),
                Student::where('parent_user_id', '!=', $parentId)->firstOrFail()->getTranslation('name', 'en'),
            ];
        });

        // Asking for someone else's child by name falls back to their own.
        $this->replies(['tool' => 'my_child_summary', 'args' => ['child' => $other]], ['reply' => 'Done.', 'links' => []]);
        $this->ask($parent, "How is {$other} doing?")->assertOk();

        $content = Http::recorded()[1][0]['messages'][3]['content'];
        $this->assertStringContainsString($mine, $content);
        $this->assertStringNotContainsString($other, $this->toolResult($content)['children'][0]['name']);
        $this->assertArrayHasKey('attendance_last_30_days', $this->toolResult($content)['children'][0]);
    }

    public function test_every_tool_runs_for_every_role_that_may_use_it(): void
    {
        $accounts = [
            'test@example.com' => 'admin',
            'mona.ali@teachers.demo' => 'teacher',
            'ali.hassan1.parent@demo.school' => 'parent',
            'ali.hassan1.student@demo.school' => 'student',
        ];
        $ran = [];

        foreach ($accounts as $email => $role) {
            $this->inSchool(function () use ($email, $role, &$ran) {
                // Inside the school, roles and permissions are this school's.
                $user = User::where('email', $email)->firstOrFail();
                $context = new ToolContext($user, $this->school);

                foreach (app(AssistantTools::class)->for($context) as $name => $tool) {
                    // The fewest args that pass the tool's rules.
                    $result = $tool->run($context, ['find_student' => ['name' => 'Ali']][$name] ?? []);
                    $this->assertIsArray($result, "{$name} as {$role}");
                    $this->assertNotFalse(json_encode($result), "{$name} as {$role}");
                    $this->assertArrayNotHasKey('error', $result, "{$name} as {$role}: ".json_encode($result));
                    $ran[$name] = true;
                }
            });
        }

        $this->assertEqualsCanonicalizing(
            array_map(fn ($class) => app($class)->name(), config('ai.assistant_tools')),
            array_keys($ran),
        );
    }

    private function enableData(string $admin): void
    {
        $this->as($admin)->putJson('/api/settings', ['settings' => [['key' => 'assistant_data', 'value' => '1']]])->assertOk();
    }

    /** Fakes the next replies, with a fresh record of what's sent. */
    private function replies(array ...$replies): void
    {
        Http::swap(new Factory(app('events')));
        $sequence = Http::sequence();
        foreach ($replies as $reply) {
            $sequence->push(['model' => 'test/model', 'choices' => [['message' => ['content' => json_encode($reply)]]]]);
        }
        Http::fake(['openrouter.ai/*' => $sequence]);
    }

    private function sentSystem(int $call): string
    {
        return Http::recorded()[$call][0]['messages'][0]['content'];
    }

    private function toolResult(string $content): array
    {
        preg_match('#<tool-result>\s*(.*?)\s*</tool-result>#s', $content, $m);

        return json_decode($m[1], true);
    }

    private function ask(string $token, string $message): TestResponse
    {
        return $this->as($token)->postJson('/api/assistant/messages', ['message' => $message, 'links' => self::LINKS]);
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
