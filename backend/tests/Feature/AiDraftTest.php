<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Models\AiUsage;
use App\Models\Plan;
use App\Models\School;
use App\Models\Subject;
use App\Models\User;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\SignsInAsSystemAdmin;
use Tests\Fakes\TestEventDrafter;
use Tests\TestCase;

/**
 * Phase 1 of docs/ai-assistant-plan.md: the shared AI layer — draft kinds
 * validated in PHP, gated by plan, school setting and permission, capped
 * per day and logged without their content.
 */
class AiDraftTest extends TestCase
{
    use RefreshDatabase;
    use SignsInAsSystemAdmin;

    private School $school;

    private string $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        $this->school = School::query()->oldest('id')->firstOrFail();
        $this->admin = $this->token(MembershipRole::Admin);

        config([
            'services.openrouter.key' => 'test-key',
            'ai.drafts' => ['test_event' => TestEventDrafter::class],
            'ai.caps' => ['user_daily' => 50, 'school_daily' => 300],
        ]);
    }

    public function test_a_draft_comes_back_validated_and_logged_without_its_content(): void
    {
        [$math, $foreign] = $this->subjects();
        $this->reply("Sure!\n```json\n".json_encode([
            'title' => ['en' => 'Sports day', 'ar' => 'اليوم الرياضي'],
            'description' => ['en' => '', 'ar' => ''],
            'level' => 'WARNING',
            'subject_ids' => [$math, $foreign, 9999, 'x', $math],
        ])."\n```", ['prompt_tokens' => 120, 'completion_tokens' => 80]);

        $this->draft(['notes' => 'sports day thursday', 'context' => ['grade' => 'Grade 4', 'secret' => 'not sent']])
            ->assertOk()
            ->assertExactJson(['draft' => [
                'title' => ['en' => 'Sports day', 'ar' => 'اليوم الرياضي'],
                'description' => null,
                'level' => 'warning',
                'subject_ids' => [$math],
            ]]);

        Http::assertSent(fn ($request) => $request['messages'][1]['content'] === "Grade: Grade 4\nNotes:\nsports day thursday");

        $usage = AiUsage::sole();
        $this->assertSame('draft.test_event', $usage->feature);
        $this->assertSame($this->school->id, $usage->school_id);
        $this->assertNotNull($usage->user_id);
        $this->assertTrue($usage->ok);
        $this->assertSame([120, 80], [$usage->prompt_tokens, $usage->completion_tokens]);
    }

    public function test_an_unusable_reply_is_a_friendly_error(): void
    {
        Http::fake(['openrouter.ai/*' => Http::sequence()
            ->push(['choices' => [['message' => ['content' => 'Sorry, I cannot help.']]]])
            ->push(['choices' => [['message' => ['content' => '{"title":{"en":"Only English"}}']]]])
            ->push(['choices' => [['message' => ['content' => '{"title":{"en":"a","ar":"ب"},"description":{"en":"half"}}']]]])
            ->push(['error' => ['message' => 'Rate limit exceeded']], 429)]);

        foreach (range(1, 4) as $_) {
            $this->draft()->assertStatus(502)->assertJsonPath('message', __('api.ai_draft_failed'));
        }

        $this->assertSame(
            ['bad_reply', 'bad_reply', 'bad_reply', 'http_429'],
            AiUsage::orderBy('id')->pluck('error')->all(),
        );
        $this->assertSame(0, AiUsage::where('ok', true)->count());
    }

    public function test_without_a_key_or_switched_off_nothing_is_sent(): void
    {
        Http::fake();

        config(['services.openrouter.key' => null]);
        $this->draft()->assertStatus(503);
        $this->as($this->admin)->getJson('/api/user')->assertJsonPath('user.ai_available', false);

        config(['services.openrouter.key' => 'test-key', 'ai.enabled' => false]);
        $this->draft()->assertStatus(503);

        Http::assertNothingSent();
        $this->assertDatabaseCount('ai_usage', 0);
    }

    public function test_a_plan_without_ai_is_refused(): void
    {
        Http::fake();
        $this->assertTrue(Plan::where('key', 'unlimited')->sole()->includes('ai'));
        $this->assertFalse(Plan::where('key', 'basic')->sole()->includes('ai'));
        $this->as($this->admin)->getJson('/api/user')->assertJsonPath('user.ai_available', true);

        $this->school->update(['plan_id' => Plan::where('key', 'basic')->value('id')]);

        $this->draft()->assertForbidden()->assertJsonPath('message', 'Not included in your plan.');
        $this->as($this->admin)->getJson('/api/user')->assertJsonPath('user.ai_available', false);
        Http::assertNothingSent();
    }

    public function test_the_schools_admin_can_turn_ai_off(): void
    {
        Http::fake();
        $settings = fn (string $value) => $this->as($this->admin)->putJson('/api/settings', ['settings' => [['key' => 'ai_enabled', 'value' => $value]]]);

        $settings('yes')->assertJsonValidationErrors('ai_enabled');
        $settings('0')->assertOk();

        $this->draft()->assertForbidden()->assertJsonPath('message', __('api.ai_disabled'));
        $this->as($this->admin)->getJson('/api/user')->assertJsonPath('user.ai_available', false);

        $settings('1')->assertOk();
        $this->as($this->admin)->getJson('/api/user')->assertJsonPath('user.ai_available', true);
        Http::assertNothingSent();
    }

    public function test_the_kind_decides_who_may_draft(): void
    {
        Http::fake();

        $this->draft([], $this->token(MembershipRole::Teacher))->assertForbidden();
        $this->as($this->admin)->postJson('/api/ai/draft/nope', ['notes' => 'x'])->assertNotFound();
        $this->draft(['notes' => ''])->assertJsonValidationErrors('notes');
        $this->draft(['notes' => 'x', 'context' => ['grade' => str_repeat('g', 51)]])->assertJsonValidationErrors('context.grade');

        Http::assertNothingSent();
    }

    public function test_daily_caps_stop_calls_per_user_and_per_school(): void
    {
        $this->reply('{"title":{"en":"a","ar":"ب"}}');
        config(['ai.caps' => ['user_daily' => 2, 'school_daily' => 3]]);

        $this->draft()->assertOk();
        $this->draft()->assertOk();
        $this->draft()->assertStatus(429)->assertJsonPath('message', __('api.ai_cap_reached_user'));

        $other = $this->token(MembershipRole::Admin);
        $this->draft([], $other)->assertOk();
        $this->draft([], $other)->assertStatus(429)->assertJsonPath('message', __('api.ai_cap_reached_school'));

        // Refused calls aren't logged, so they don't use up tomorrow's.
        $this->assertDatabaseCount('ai_usage', 3);
    }

    public function test_the_announcement_draft_is_logged_and_the_dashboard_sums_usage(): void
    {
        $platform = $this->systemAdminToken(User::factory()->create(['is_platform_admin' => true]));
        $this->reply('{"title":{"en":"Hi","ar":"مرحبا"},"body":{"en":"Hello.","ar":"أهلا."},"level":"info","audience":[]}', ['prompt_tokens' => 10, 'completion_tokens' => 5]);

        $this->as($platform)->postJson('/api/platform/announcements/draft', ['notes' => 'hello'])->assertOk();
        $this->assertDatabaseHas('ai_usage', ['feature' => 'draft.announcement', 'school_id' => null, 'ok' => true]);

        $this->draft()->assertOk();
        AiUsage::create(['school_id' => $this->school->id, 'feature' => 'draft.test_event', 'duration_ms' => 5, 'ok' => false, 'error' => 'unreachable']);
        AiUsage::forceCreate(['school_id' => $this->school->id, 'feature' => 'draft.test_event', 'duration_ms' => 5, 'ok' => true, 'created_at' => now()->subDays(40)]);

        $this->as($platform)->getJson('/api/platform/overview')
            ->assertOk()
            ->assertJsonPath('ai_usage.calls_30d', 3)
            ->assertJsonPath('ai_usage.failed_30d', 1)
            ->assertJsonPath('ai_usage.tokens_30d', 30)
            ->assertJsonPath('ai_usage.calls_today', 3)
            ->assertJsonPath('ai_usage.by_school.0', [
                'school_id' => $this->school->id,
                'name' => $this->school->name,
                'calls' => 2,
                'failed' => 1,
                'tokens' => 15,
            ]);
    }

    /** @return array{0: int, 1: int} a subject at this school and one at another */
    private function subjects(): array
    {
        $other = School::create(['name' => 'Other', 'slug' => 'other-school']);
        $make = fn (School $school, string $name) => app(TenantContext::class)->runAs($school, fn () => Subject::create(['name' => ['en' => $name, 'ar' => $name]])->id);

        return [$make($this->school, 'Math'), $make($other, 'Science')];
    }

    private function reply(string $content, array $usage = []): void
    {
        Http::fake(['openrouter.ai/*' => Http::response([
            'model' => 'test/model',
            'choices' => [['message' => ['content' => $content]]],
            'usage' => $usage,
        ])]);
    }

    private function draft(array $body = [], ?string $token = null): TestResponse
    {
        return $this->as($token ?? $this->admin)->postJson('/api/ai/draft/test_event', $body ?: ['notes' => 'x']);
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
