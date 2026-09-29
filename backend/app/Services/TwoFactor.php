<?php

namespace App\Services;

use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PragmaRX\Google2FA\Google2FA;

/**
 * Two-factor (TOTP, an authenticator app) for system admins. Their login
 * is two steps: a correct password starts a short-lived challenge, and a
 * code completes it. There is no way around it: an admin without 2FA sets
 * it up as part of that first login. See docs/central-dashboard-plan.md,
 * phase 1.
 */
class TwoFactor
{
    private const CHALLENGE_MINUTES = 5;

    private const RECOVERY_CODES = 8;

    public function __construct(private readonly Google2FA $google2fa) {}

    /**
     * After a correct password. "setup" carries the new secret (and its QR
     * code) the admin scans; "challenge" just asks for a code.
     *
     * @return array{two_factor: 'setup'|'challenge', challenge_id: string, secret?: string, otpauth_url?: string, qr_svg?: string}
     */
    public function startChallenge(User $user): array
    {
        $challengeId = Str::random(40);
        $confirmed = $user->two_factor_confirmed_at !== null && $user->two_factor_secret !== null;

        // Set up: the secret isn't saved on the account until a code from
        // it confirms the admin actually scanned it.
        $secret = $confirmed ? null : $this->google2fa->generateSecretKey(32);

        Cache::put($this->key($challengeId), ['user_id' => $user->id, 'setup_secret' => $secret], now()->addMinutes(self::CHALLENGE_MINUTES));

        if ($confirmed) {
            return ['two_factor' => 'challenge', 'challenge_id' => $challengeId];
        }

        $url = $this->google2fa->getQRCodeUrl(config('app.name'), $user->email, $secret);

        return [
            'two_factor' => 'setup',
            'challenge_id' => $challengeId,
            'secret' => $secret,
            'otpauth_url' => $url,
            'qr_svg' => (new Writer(new ImageRenderer(new RendererStyle(192, 1), new SvgImageBackEnd)))->writeString($url),
        ];
    }

    /**
     * Completes a challenge with a code from the app (or, once set up, a
     * recovery code). Single use: a completed challenge can't be replayed.
     *
     * @return array{user: User, recovery_codes: list<string>|null} recovery_codes only right after setup, to show once
     */
    public function completeChallenge(string $challengeId, ?string $code, ?string $recoveryCode): array
    {
        $challenge = Cache::get($this->key($challengeId));
        $user = $challenge ? User::find($challenge['user_id']) : null;

        if (! $user?->is_platform_admin) {
            throw ValidationException::withMessages(['code' => __('auth.two_factor_expired')]);
        }

        $setupSecret = $challenge['setup_secret'];
        $recoveryCodes = null;

        if ($setupSecret !== null) {
            $this->verifyCode($user, $setupSecret, $code);

            $recoveryCodes = $this->newRecoveryCodes();
            $user->forceFill([
                'two_factor_secret' => $setupSecret,
                'two_factor_recovery_codes' => $recoveryCodes,
                'two_factor_confirmed_at' => now(),
            ])->save();
        } elseif (filled($recoveryCode)) {
            $this->useRecoveryCode($user, $recoveryCode);
        } else {
            $this->verifyCode($user, $user->two_factor_secret, $code);
        }

        Cache::forget($this->key($challengeId));

        return ['user' => $user, 'recovery_codes' => $recoveryCodes];
    }

    /** A current code for $user, for re-confirming before dangerous actions (phase 5). */
    public function verify(User $user, ?string $code): void
    {
        $this->verifyCode($user, $user->two_factor_secret, $code);
    }

    /** CLI only (platform:reset-2fa): set up again at the next login. */
    public function reset(User $user): void
    {
        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();
    }

    private function verifyCode(User $user, ?string $secret, ?string $code): void
    {
        $code = preg_replace('/\s+/', '', (string) $code);

        // Each code works once: a code seen over someone's shoulder can't be
        // reused within its 30-second window.
        $usedKey = "two-factor-used:{$user->id}:{$code}";

        if ($secret === null || $code === '' || Cache::has($usedKey) || ! $this->google2fa->verifyKey($secret, $code, 1)) {
            throw ValidationException::withMessages(['code' => __('auth.two_factor_invalid')]);
        }

        Cache::put($usedKey, true, now()->addMinutes(2));
    }

    private function useRecoveryCode(User $user, string $recoveryCode): void
    {
        $codes = $user->two_factor_recovery_codes ?? [];
        $match = collect($codes)->first(fn (string $c) => hash_equals($c, trim($recoveryCode)));

        if ($match === null) {
            throw ValidationException::withMessages(['recovery_code' => __('auth.two_factor_recovery_invalid')]);
        }

        $user->forceFill(['two_factor_recovery_codes' => array_values(array_diff($codes, [$match]))])->save();
    }

    /** @return list<string> */
    private function newRecoveryCodes(): array
    {
        return collect(range(1, self::RECOVERY_CODES))
            ->map(fn () => Str::lower(Str::random(5).'-'.Str::random(5)))
            ->all();
    }

    private function key(string $challengeId): string
    {
        return "two-factor-challenge:{$challengeId}";
    }
}
