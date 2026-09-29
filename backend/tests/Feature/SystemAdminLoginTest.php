<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Models\School;
use App\Models\User;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

/**
 * Phase 1 of docs/central-dashboard-plan.md: the system admin's own login,
 * not tied to a school, with required two-factor.
 */
class SystemAdminLoginTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        // No school membership: a system admin doesn't need one.
        $this->admin = User::factory()->create(['is_platform_admin' => true]);
    }

    public function test_the_first_login_sets_up_two_factor_and_signs_in(): void
    {
        $challenge = $this->password()->assertOk()
            ->assertJsonPath('two_factor', 'setup')
            ->assertJsonMissingPath('token')
            ->json();
        $this->assertStringContainsString('<svg', $challenge['qr_svg']);
        $this->assertStringStartsWith('otpauth://totp/', $challenge['otpauth_url']);

        $response = $this->code($challenge['challenge_id'], $this->otp($challenge['secret']))
            ->assertOk()
            ->assertJsonPath('user.is_platform_admin', true)
            ->assertJsonPath('user.current_membership', null)
            ->assertJsonCount(8, 'recovery_codes');

        $this->assertNotNull($this->admin->fresh()->two_factor_confirmed_at);
        $this->assertSame($challenge['secret'], $this->admin->fresh()->two_factor_secret);

        $this->app['auth']->forgetGuards();
        $this->withToken($response->json('token'))->getJson('/api/platform/schools')->assertOk();
    }

    public function test_later_logins_ask_for_a_code_only(): void
    {
        $secret = $this->setUpTwoFactor();

        $challenge = $this->password()->assertOk()->assertJsonPath('two_factor', 'challenge')->assertJsonMissingPath('secret')->json();

        $this->code($challenge['challenge_id'], $this->nextOtp($secret))->assertOk()->assertJsonMissingPath('recovery_codes');
    }

    public function test_a_wrong_code_is_refused_and_the_challenge_stays_open(): void
    {
        $secret = $this->setUpTwoFactor();
        $challengeId = $this->password()->json('challenge_id');

        $this->code($challengeId, '000000')->assertJsonValidationErrors('code');
        $this->code($challengeId, $this->nextOtp($secret))->assertOk();
    }

    public function test_a_challenge_works_once(): void
    {
        $secret = $this->setUpTwoFactor();
        $challengeId = $this->password()->json('challenge_id');
        $this->code($challengeId, $this->nextOtp($secret))->assertOk();

        // A code not used yet, but the challenge is gone.
        $this->code($challengeId, $this->otp($secret, -1))->assertJsonValidationErrors('code');
    }

    public function test_a_code_cannot_be_reused_in_its_window(): void
    {
        $secret = $this->setUpTwoFactor();
        $code = $this->nextOtp($secret);
        $this->code($this->password()->json('challenge_id'), $code)->assertOk();

        $this->code($this->password()->json('challenge_id'), $code)->assertJsonValidationErrors('code');
    }

    public function test_a_recovery_code_signs_in_once(): void
    {
        $challenge = $this->password()->json();
        $codes = $this->code($challenge['challenge_id'], $this->otp($challenge['secret']))->json('recovery_codes');

        $this->postJson('/api/login/two-factor', ['challenge_id' => $this->password()->json('challenge_id'), 'recovery_code' => $codes[0]])
            ->assertOk();
        $this->postJson('/api/login/two-factor', ['challenge_id' => $this->password()->json('challenge_id'), 'recovery_code' => $codes[0]])
            ->assertJsonValidationErrors('recovery_code');

        $this->assertCount(7, $this->admin->fresh()->two_factor_recovery_codes);
    }

    public function test_the_form_does_not_reveal_who_is_a_system_admin(): void
    {
        $someone = User::factory()->create();

        $this->postJson('/api/login', ['email' => $someone->email, 'password' => 'password', 'role' => 'system'])
            ->assertJsonValidationErrors('email');
        $this->postJson('/api/login', ['email' => $this->admin->email, 'password' => 'wrong', 'role' => 'system'])
            ->assertJsonValidationErrors('email');
    }

    public function test_a_platform_token_reads_no_school_data(): void
    {
        $school = School::query()->oldest('id')->firstOrFail();
        // Even for a system admin who is also a school's admin.
        app(TenantContext::class)->runAs($school, fn () => app(MembershipService::class)->grant($this->admin, MembershipRole::Admin));

        $challenge = $this->password()->json();
        $token = $this->code($challenge['challenge_id'], $this->otp($challenge['secret']))->json('token');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/stages')->assertForbidden();
        $this->withToken($token)->getJson('/api/user')->assertJsonPath('user.current_membership', null);
    }

    public function test_with_two_factor_turned_off_the_password_signs_in(): void
    {
        config(['platform.two_factor' => false]);

        $token = $this->password()->assertOk()
            ->assertJsonMissingPath('two_factor')
            ->assertJsonPath('user.is_platform_admin', true)
            ->assertJsonPath('user.platform_two_factor', false)
            ->json('token');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/platform/schools')->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.signed_in', 'actor_id' => $this->admin->id]);

        // Still only for system admins.
        $someone = User::factory()->create();
        $this->postJson('/api/login', ['email' => $someone->email, 'password' => 'password', 'role' => 'system'])->assertJsonValidationErrors('email');
    }

    public function test_the_cli_resets_two_factor(): void
    {
        $this->setUpTwoFactor();

        $this->artisan('platform:reset-2fa', ['email' => $this->admin->email])->assertSuccessful();

        $this->assertNull($this->admin->fresh()->two_factor_confirmed_at);
        $this->password()->assertJsonPath('two_factor', 'setup');
    }

    private function setUpTwoFactor(): string
    {
        $challenge = $this->password()->json();
        $this->code($challenge['challenge_id'], $this->otp($challenge['secret']))->assertOk();

        return $challenge['secret'];
    }

    private function password(): TestResponse
    {
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->postJson('/api/login', ['email' => $this->admin->email, 'password' => 'password', 'role' => 'system']);
    }

    private function code(string $challengeId, string $code): TestResponse
    {
        return $this->postJson('/api/login/two-factor', ['challenge_id' => $challengeId, 'code' => $code]);
    }

    /** The code for the current 30-second window, or one before/after it. */
    private function otp(string $secret, int $windows = 0): string
    {
        $google2fa = app(Google2FA::class);

        return $google2fa->oathTotp($secret, $google2fa->getTimestamp() + $windows);
    }

    private function nextOtp(string $secret): string
    {
        return $this->otp($secret, 1);
    }
}
