<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Models\AiUsage;
use App\Models\AssistantConversation;
use App\Models\Plan;
use App\Models\School;
use App\Models\User;
use App\Services\Ai\Assistant\HelpLibrary;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Phase 4 of docs/ai-assistant-plan.md: the help assistant — answers from
 * the help pages this user may read, links only to their own pages, history
 * per user and school for 30 days, same gates and caps as drafts.
 */
class AssistantTest extends TestCase
{
    use RefreshDatabase;

    private School $school;

    private string $admin;

    private const LINKS = [
        ['href' => '/attendance', 'label' => 'Take attendance'],
        ['href' => '/classrooms', 'label' => 'Classrooms'],
    ];

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        $this->school = School::query()->oldest('id')->firstOrFail();
        $this->admin = $this->token(MembershipRole::Admin);

        config([
            'services.openrouter.key' => 'test-key',
            'ai.caps' => ['user_daily' => 50, 'school_daily' => 300],
        ]);
    }

    public function test_an_answer_is_saved_with_only_the_users_own_links(): void
    {
        $this->reply("Here you go:\n".json_encode([
            'reply' => 'Open **Attendance**, pick the classroom and date, then save.',
            'links' => ['/attendance', '/platform/schools', '/attendance', 42],
        ]), ['prompt_tokens' => 300, 'completion_tokens' => 40]);

        $response = $this->ask(['message' => 'How do I take attendance?', 'page' => '/classrooms'])
            ->assertOk()
            ->assertJsonPath('messages.0.role', 'user')
            ->assertJsonPath('messages.0.content', 'How do I take attendance?')
            ->assertJsonPath('messages.1.role', 'assistant')
            ->assertJsonPath('messages.1.links', ['/attendance']);

        $conversation = AssistantConversation::sole();
        $this->assertSame($response->json('conversation_id'), $conversation->id);
        $this->assertSame('How do I take attendance?', $conversation->title);
        $this->assertDatabaseCount('assistant_messages', 2);

        // The prompt carries who's asking, their pages and the matching help page.
        Http::assertSent(function ($request) {
            $system = $request['messages'][0]['content'];

            return str_contains($system, 'Role: admin')
                && str_contains($system, '/attendance — Take attendance')
                && str_contains($system, 'title="Taking attendance"')
                && str_contains($system, 'Current page: /classrooms')
                && $request['messages'][1] === ['role' => 'user', 'content' => 'How do I take attendance?'];
        });

        $usage = AiUsage::sole();
        $this->assertSame('assistant', $usage->feature);
        $this->assertSame($this->school->id, $usage->school_id);
        $this->assertTrue($usage->ok);
    }

    public function test_a_conversation_continues_with_its_history(): void
    {
        $this->reply('{"reply":"Use Classrooms.","links":[]}');

        $id = $this->ask(['message' => 'How do I add a classroom?'])->json('conversation_id');
        $this->ask(['message' => 'And a grade?', 'conversation_id' => $id])->assertOk()->assertJsonPath('conversation_id', $id);

        Http::assertSent(fn ($request) => count($request['messages']) === 4
            && $request['messages'][1]['content'] === 'How do I add a classroom?'
            && $request['messages'][2] === ['role' => 'assistant', 'content' => 'Use Classrooms.']
            && $request['messages'][3]['content'] === 'And a grade?');

        $this->as($this->admin)->getJson('/api/assistant/conversation')
            ->assertOk()
            ->assertJsonPath('conversation.id', $id)
            ->assertJsonCount(4, 'conversation.messages');
    }

    public function test_conversations_are_private_to_their_owner(): void
    {
        $this->reply('{"reply":"Sure.","links":[]}');
        $id = $this->ask(['message' => 'Hello'])->json('conversation_id');

        $other = $this->token(MembershipRole::Admin);
        $this->ask(['message' => 'Hi', 'conversation_id' => $id], $other)->assertNotFound();
        $this->as($other)->getJson('/api/assistant/conversation')->assertOk()->assertJsonPath('conversation', null);

        // Clearing history only touches the caller's own conversations.
        $this->as($other)->deleteJson('/api/assistant/conversations')->assertNoContent();
        $this->assertDatabaseCount('assistant_conversations', 1);
        $this->as($this->admin)->deleteJson('/api/assistant/conversations')->assertNoContent();
        $this->assertDatabaseCount('assistant_conversations', 0);
        $this->assertDatabaseCount('assistant_messages', 0);
    }

    public function test_help_pages_follow_the_users_role_and_plan(): void
    {
        $this->reply('{"reply":"Ask your admin.","links":[]}');
        $teacher = $this->token(MembershipRole::Teacher);
        $student = $this->token(MembershipRole::Student);

        $sentHelp = function (string $token, string $question) {
            $this->ask(['message' => $question], $token)->assertOk();
            $system = Http::recorded()->last()[0]['messages'][0]['content'];
            preg_match_all('/<help-page title="([^"]+)">/', $system, $m);

            return $m[1];
        };

        $this->assertContains('Fees and payments', $sentHelp($this->admin, 'How do I record a fee payment?'));
        $this->assertNotContains('Fees and payments', $sentHelp($teacher, 'How do I record a fee payment?'));
        $this->assertContains('Taking attendance', $sentHelp($teacher, 'How do I mark a student absent?'));
        $this->assertNotContains('Taking attendance', $sentHelp($student, 'How do I mark a student absent?'));
        $this->assertContains('Your student portal', $sentHelp($student, 'Where are my exams?'));

        // A plan without fees: the fees page isn't sent even to the admin.
        $plan = Plan::create(['key' => 'no-fees', 'name' => 'No fees', 'features' => ['exams', 'ai']]);
        $this->school->update(['plan_id' => $plan->id]);
        $this->assertNotContains('Fees and payments', $sentHelp($this->admin, 'How do I record a fee payment?'));
    }

    public function test_arabic_questions_get_arabic_help(): void
    {
        $this->reply('{"reply":"افتح صفحة الحضور.","links":["/attendance"]}');

        $this->ask(['message' => 'كيف أسجل الحضور؟', 'links' => self::LINKS], $this->admin, 'ar')
            ->assertOk()
            ->assertJsonPath('messages.1.content', 'افتح صفحة الحضور.');

        Http::assertSent(fn ($request) => str_contains($request['messages'][0]['content'], 'title="أخذ الحضور"')
            && str_contains($request['messages'][0]['content'], 'Reply in Arabic'));
    }

    public function test_bad_replies_and_refusals(): void
    {
        Http::fake(['openrouter.ai/*' => Http::sequence()
            ->push(['choices' => [['message' => ['content' => 'I am not JSON']]]])
            ->push(['choices' => [['message' => ['content' => '{"reply":"   ","links":[]}']]]])]);

        $this->ask()->assertStatus(502)->assertJsonPath('message', __('api.assistant_failed'));
        $this->ask()->assertStatus(502);
        $this->assertDatabaseCount('assistant_conversations', 0);

        $this->ask(['message' => ''])->assertJsonValidationErrors('message');
        $this->ask(['message' => 'x', 'page' => 'https://evil.test'])->assertJsonValidationErrors('page');
        $this->ask(['message' => 'x', 'links' => [['href' => 'javascript:alert(1)', 'label' => 'x']]])->assertJsonValidationErrors('links.0.href');
    }

    public function test_the_same_gates_as_drafts(): void
    {
        Http::fake();

        config(['services.openrouter.key' => null]);
        $this->ask()->assertStatus(503);
        config(['services.openrouter.key' => 'test-key']);

        $this->school->update(['plan_id' => Plan::where('key', 'basic')->value('id')]);
        $this->ask()->assertForbidden();
        $this->as($this->admin)->getJson('/api/assistant/conversation')->assertForbidden();
        // Clearing what's kept still works without the plan.
        $this->as($this->admin)->deleteJson('/api/assistant/conversations')->assertNoContent();
        $this->school->update(['plan_id' => null]);

        $this->as($this->admin)->putJson('/api/settings', ['settings' => [['key' => 'ai_enabled', 'value' => '0']]])->assertOk();
        $this->ask()->assertForbidden()->assertJsonPath('message', __('api.ai_disabled'));

        Http::assertNothingSent();
    }

    public function test_daily_caps_count_assistant_messages(): void
    {
        $this->reply('{"reply":"Ok.","links":[]}');
        config(['ai.caps' => ['user_daily' => 1, 'school_daily' => 300]]);

        $this->ask()->assertOk();
        $this->ask()->assertStatus(429)->assertJsonPath('message', __('api.ai_cap_reached_user'));
    }

    public function test_old_conversations_are_hidden_and_pruned(): void
    {
        $this->reply('{"reply":"Ok.","links":[]}');
        $id = $this->ask()->json('conversation_id');

        AssistantConversation::whereKey($id)->update(['updated_at' => now()->subDays(31)]);

        $this->as($this->admin)->getJson('/api/assistant/conversation')->assertJsonPath('conversation', null);
        $this->ask(['message' => 'x', 'conversation_id' => $id])->assertNotFound();

        $this->artisan('assistant:prune')->assertSuccessful();
        $this->assertDatabaseCount('assistant_conversations', 0);
        $this->assertDatabaseCount('assistant_messages', 0);
    }

    public function test_every_help_page_parses_in_both_languages(): void
    {
        $library = app(HelpLibrary::class);
        $en = collect($library->all('en'))->keyBy('key');
        $ar = collect($library->all('ar'))->keyBy('key');

        $this->assertGreaterThan(10, $en->count());
        $this->assertEqualsCanonicalizing($en->keys()->all(), $ar->keys()->all());

        foreach ($en as $key => $page) {
            $this->assertNotSame($key, $page->title, "{$key} has no title");
            $this->assertNotSame('', $page->body);
            // Same gates in both languages.
            $this->assertSame([$page->access, $page->feature, $page->pages], [$ar[$key]->access, $ar[$key]->feature, $ar[$key]->pages], $key);
            foreach ($page->access as $rule) {
                $this->assertMatchesRegularExpression('/^(role:(admin|teacher|student|parent)|manage-[a-z]+)$/', $rule, $key);
            }
        }
    }

    private function reply(string $content, array $usage = []): void
    {
        Http::fake(['openrouter.ai/*' => Http::response([
            'model' => 'test/model',
            'choices' => [['message' => ['content' => $content]]],
            'usage' => $usage,
        ])]);
    }

    private function ask(array $body = [], ?string $token = null, string $locale = 'en'): TestResponse
    {
        return $this->as($token ?? $this->admin)
            ->withHeader('Accept-Language', $locale)
            ->postJson('/api/assistant/messages', ($body ?: ['message' => 'How do I add a classroom?']) + ['links' => self::LINKS]);
    }

    private function token(MembershipRole $role): string
    {
        $user = User::factory()->create();
        app(TenantContext::class)->runAs($this->school, fn () => app(MembershipService::class)->grant($user, $role));
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->postJson('/api/login', ['email' => $user->email, 'password' => 'password', 'role' => $role->value])->json('token');
    }

    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->withToken($token);
    }
}
