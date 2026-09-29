<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Models\AuditLog;
use App\Models\PlatformSession;
use App\Models\School;
use App\Models\Stage;
use App\Models\User;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PragmaRX\Google2FA\Google2FA;
use Tests\Concerns\SignsInAsSystemAdmin;
use Tests\TestCase;

/**
 * Phase 5 of docs/central-dashboard-plan.md: a system admin enters a school
 * as its admin, with a fresh code, a banner, and everything audited.
 */
class PlatformSessionTest extends TestCase
{
    use RefreshDatabase;
    use SignsInAsSystemAdmin;

    private User $systemAdmin;

    private School $school;

    private School $other;

    private string $platformToken;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        $this->school = School::query()->oldest('id')->firstOrFail();
        $this->other = School::create(['name' => 'Other School', 'slug' => 'other-school']);

        $this->systemAdmin = User::factory()->create(['is_platform_admin' => true]);
        $this->platformToken = $this->systemAdminToken($this->systemAdmin);
    }

    public function test_entering_needs_a_fresh_code(): void
    {
        $this->asPlatform()->postJson("/api/platform/schools/{$this->school->id}/enter")->assertJsonValidationErrors('code');
        $this->asPlatform()->postJson('/api/platform/confirm', ['code' => '000000'])->assertJsonValidationErrors('code');

        $this->assertSame(0, PlatformSession::count());
    }

    public function test_with_two_factor_turned_off_entering_needs_no_code(): void
    {
        config(['platform.two_factor' => false]);

        $this->asPlatform()->postJson("/api/platform/schools/{$this->school->id}/enter")
            ->assertCreated()
            ->assertJsonPath('user.acting_as.school_id', $this->school->id);
    }

    public function test_the_session_acts_as_the_schools_admin_and_nowhere_else(): void
    {
        $response = $this->enter()
            ->assertCreated()
            ->assertJsonPath('user.roles', ['admin'])
            ->assertJsonPath('user.acting_as.type', 'system_admin')
            ->assertJsonPath('user.acting_as.school_id', $this->school->id);
        $token = $response->json('token');

        app(TenantContext::class)->runAs($this->other, fn () => Stage::create(['name' => ['en' => 'Theirs', 'ar' => 'Theirs']]));

        // Full admin at this school: reads and writes.
        $this->with($token)->getJson('/api/stages')->assertOk()->assertJsonCount(0, 'stages');
        $this->with($token)->postJson('/api/stages', ['name' => ['en' => 'Primary', 'ar' => 'ابتدائي']])->assertCreated();
        $this->with($token)->getJson('/api/user')
            ->assertJsonPath('user.acting_as.school_name', $this->school->name)
            ->assertJsonPath('user.current_membership', null);

        // Not a platform token, and never a member.
        $this->with($token)->getJson('/api/platform/overview')->assertForbidden();
        $this->assertSame(0, $this->systemAdmin->memberships()->count());

        // The platform token still works, to come back.
        $this->asPlatform()->getJson('/api/platform/overview')->assertOk();
    }

    public function test_everything_done_inside_is_audited_without_values(): void
    {
        $token = $this->enter(['reason' => 'Ticket #42: fix grades'])->json('token');

        $this->with($token)->postJson('/api/stages', ['name' => ['en' => 'Primary', 'ar' => 'ابتدائي']])->assertCreated();

        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.entered_school', 'school_id' => $this->school->id, 'actor_id' => $this->systemAdmin->id]);
        $write = AuditLog::where('action', 'platform.request')->where('details->method', 'POST')->sole();
        $this->assertSame($this->school->id, $write->school_id);
        $this->assertSame(['name'], $write->details['fields']);
        $this->assertStringNotContainsString('ابتدائي', json_encode($write->details));
        $this->assertSame(201, $write->details['status']);
        $this->assertSame('Ticket #42: fix grades', AuditLog::where('action', 'platform.entered_school')->sole()->details['reason']);
    }

    public function test_exiting_ends_the_session_and_revokes_its_token(): void
    {
        $token = $this->enter()->json('token');

        $this->with($token)->postJson('/api/platform/exit')->assertNoContent();

        $this->assertNotNull(PlatformSession::sole()->ended_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.exited_school', 'school_id' => $this->school->id]);
        $this->with($token)->getJson('/api/user')->assertUnauthorized();
    }

    public function test_an_expired_session_signs_out(): void
    {
        $token = $this->enter()->json('token');

        $this->travel(PlatformSession::HOURS)->hours();
        $this->travel(1)->minutes();

        $this->with($token)->getJson('/api/stages')->assertUnauthorized();
    }

    public function test_a_suspended_school_can_be_entered(): void
    {
        $this->school->update(['status' => 'suspended']);

        $token = $this->enter()->assertCreated()->json('token');

        $this->with($token)->getJson('/api/stages')->assertOk();
    }

    public function test_the_schools_admins_see_what_was_done(): void
    {
        $token = $this->enter(['reason' => 'Support request'])->json('token');
        $this->with($token)->getJson('/api/stages')->assertOk();
        $this->with($token)->postJson('/api/platform/exit')->assertNoContent();

        $schoolAdmin = User::factory()->create();
        app(TenantContext::class)->runAs($this->school, fn () => app(MembershipService::class)->grant($schoolAdmin, MembershipRole::Admin));
        $this->app['auth']->forgetGuards();
        $adminToken = $this->flushHeaders()->postJson('/api/login', ['email' => $schoolAdmin->email, 'password' => 'password', 'role' => 'admin'])->json('token');

        $response = $this->with($adminToken)->getJson('/api/admin/system-admin-activity')->assertOk();

        $this->assertSame('Support request', $response->json('sessions.0.reason'));
        $this->assertFalse($response->json('sessions.0.open'));
        $this->assertEqualsCanonicalizing(
            ['platform.entered_school', 'platform.request', 'platform.request', 'platform.exited_school'],
            collect($response->json('audit_logs'))->pluck('action')->all(),
        );
    }

    public function test_school_tokens_cannot_enter(): void
    {
        $schoolAdmin = User::factory()->create(['is_platform_admin' => true]);
        app(TenantContext::class)->runAs($this->school, fn () => app(MembershipService::class)->grant($schoolAdmin, MembershipRole::Admin));
        $token = $this->flushHeaders()->postJson('/api/login', ['email' => $schoolAdmin->email, 'password' => 'password', 'role' => 'admin'])->json('token');

        $this->with($token)->postJson("/api/platform/schools/{$this->other->id}/enter")->assertForbidden();
    }

    private function enter(array $body = []): TestResponse
    {
        // The login used this window's code; the confirmation uses the next one.
        $google2fa = app(Google2FA::class);
        $code = $google2fa->oathTotp($this->systemAdmin->fresh()->two_factor_secret, $google2fa->getTimestamp() + 1);

        $this->asPlatform()->postJson('/api/platform/confirm', ['code' => $code])->assertNoContent();

        return $this->asPlatform()->postJson("/api/platform/schools/{$this->school->id}/enter", $body);
    }

    private function asPlatform(): self
    {
        return $this->with($this->platformToken);
    }

    private function with(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->withToken($token);
    }
}
