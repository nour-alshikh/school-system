<?php

namespace Tests\Concerns;

use App\Models\User;
use PragmaRX\Google2FA\Google2FA;

/**
 * Signs in through the real system admin login: password, then a code from
 * the (set up on first use) authenticator secret.
 */
trait SignsInAsSystemAdmin
{
    /** @var array<int, string> user id => token: a code only works once, so sign in once per test. */
    private array $systemAdminTokens = [];

    /** A platform token for $user (a platform admin with password "password"). */
    protected function systemAdminToken(User $user): string
    {
        return $this->systemAdminTokens[$user->id] ??= $this->signInAsSystemAdmin($user);
    }

    private function signInAsSystemAdmin(User $user): string
    {
        $this->app['auth']->forgetGuards();

        $challenge = $this->flushHeaders()->postJson('/api/login', [
            'email' => $user->email, 'password' => 'password', 'role' => 'system',
        ])->assertOk()->json();

        $secret = $challenge['two_factor'] === 'setup' ? $challenge['secret'] : $user->fresh()->two_factor_secret;

        $token = $this->postJson('/api/login/two-factor', [
            'challenge_id' => $challenge['challenge_id'],
            'code' => app(Google2FA::class)->getCurrentOtp($secret),
        ])->assertOk()->json('token');

        $this->app['auth']->forgetGuards();

        return $token;
    }
}
