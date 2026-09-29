<?php

namespace App\Platform;

use App\Models\AuditLog;
use App\Models\PersonalAccessToken;
use App\Models\PlatformSession;
use App\Models\School;
use App\Models\User;
use App\Services\TwoFactor;
use Illuminate\Validation\ValidationException;

/**
 * Entering a school as its admin (docs/central-dashboard-plan.md, phase 5).
 * Needs a fresh two-factor code; the session lasts at most
 * PlatformSession::HOURS; everything is audited, and the school's admins
 * can see it.
 */
class PlatformSessions
{
    /** How long a re-confirmation ("sudo mode") stays good for. */
    private const CONFIRM_MINUTES = 10;

    public function __construct(private readonly TwoFactor $twoFactor) {}

    /** Re-confirms the platform token with a current code. */
    public function confirm(User $user, PersonalAccessToken $platformToken, ?string $code): void
    {
        $this->twoFactor->verify($user, $code);
        $platformToken->forceFill(['platform_confirmed_at' => now()])->save();
    }

    /**
     * Opens a session at $school and issues a token bound to it. The
     * platform token stays valid, for coming back.
     *
     * @return array{session: PlatformSession, token: string}
     */
    public function enter(User $user, PersonalAccessToken $platformToken, School $school, ?string $reason): array
    {
        if ($platformToken->platform_confirmed_at === null || $platformToken->platform_confirmed_at->lt(now()->subMinutes(self::CONFIRM_MINUTES))) {
            throw ValidationException::withMessages(['code' => __('api.platform_confirm_required')]);
        }

        $session = PlatformSession::create([
            'user_id' => $user->id,
            'school_id' => $school->id,
            'reason' => $reason,
            'started_at' => now(),
            'expires_at' => now()->addHours(PlatformSession::HOURS),
        ]);

        $token = $user->createToken('platform-session', ['school']);
        $token->accessToken->forceFill(['platform_session_id' => $session->id])->save();

        AuditLog::record('platform.entered_school', $session, array_filter(['reason' => $reason]), $school);

        return ['session' => $session, 'token' => $token->plainTextToken];
    }

    /** Ends the session and revokes its token. */
    public function exit(PersonalAccessToken $sessionToken): void
    {
        $session = PlatformSession::find($sessionToken->platform_session_id);

        if ($session && $session->ended_at === null) {
            $session->update(['ended_at' => now()]);
            AuditLog::record('platform.exited_school', $session, school: $session->school);
        }

        $sessionToken->delete();
    }
}
