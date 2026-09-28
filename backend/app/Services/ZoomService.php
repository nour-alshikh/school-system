<?php

namespace App\Services;

use App\Models\ZoomConnection;
use App\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Regular (user) OAuth, not Server-to-Server — Zoom restricts S2S apps to
 * paid plans, which this project can't assume. Instead, one admin
 * authorizes a shared Zoom account once (ZoomController::connectUrl() /
 * callback()); every meeting after that is created under that same
 * account via /users/me/meetings. No per-teacher Zoom login.
 */
class ZoomService
{
    public function isConnected(): bool
    {
        return ZoomConnection::query()->exists();
    }

    /**
     * `state` is a short-lived random token mapped in cache to who started
     * the connect flow and which locale to bounce them back to. Zoom's
     * redirect back to callback() is a plain top-level browser navigation
     * from zoom.us — its Referer is zoom.us, not our frontend, so Sanctum's
     * "fromFrontend" cookie check would never pass there. That's why
     * callback() is a public, unauthenticated route (see routes/api.php):
     * state matching this cache entry — not a session cookie — is what
     * proves the callback is legitimate, and is also how connected_by gets
     * attributed despite the request itself carrying no auth.
     */
    public function authorizeUrl(string $locale, int $connectingUserId): string
    {
        $state = Str::random(40);
        // school_id: the callback arrives with no auth, so it can't tell
        // which school's connection this is any other way.
        Cache::put("zoom_oauth_state:{$state}", [
            'locale' => $locale,
            'user_id' => $connectingUserId,
            'school_id' => app(TenantContext::class)->id(),
        ], now()->addMinutes(10));

        return 'https://zoom.us/oauth/authorize?'.http_build_query([
            'response_type' => 'code',
            'client_id' => config('services.zoom.client_id'),
            'redirect_uri' => config('services.zoom.redirect_uri'),
            'state' => $state,
        ]);
    }

    /**
     * Returns ['locale' => ..., 'user_id' => ...], or null if `state`
     * doesn't match a connect flow this service started (forged, expired,
     * or already consumed — Cache::pull() is one-shot).
     *
     * @return array{locale: string, user_id: int, school_id: int}|null
     */
    public function resolveState(string $state): ?array
    {
        return Cache::pull("zoom_oauth_state:{$state}");
    }

    public function connect(string $code, ?int $connectedByUserId): void
    {
        $response = Http::asForm()
            ->withBasicAuth(config('services.zoom.client_id'), config('services.zoom.client_secret'))
            ->post('https://zoom.us/oauth/token', [
                'grant_type' => 'authorization_code',
                'code' => $code,
                'redirect_uri' => config('services.zoom.redirect_uri'),
            ])
            ->throw()
            ->json();

        $this->storeTokens($response, $connectedByUserId);
    }

    public function disconnect(): void
    {
        ZoomConnection::query()->delete();
    }

    public function createMeeting(string $topic, ?string $agenda, Carbon $startTime, int $durationMinutes): array
    {
        $response = $this->client()
            ->post('/users/me/meetings', [
                'topic' => $topic,
                'agenda' => $agenda ?? '',
                'type' => 2, // scheduled meeting
                'start_time' => $startTime->clone()->utc()->format('Y-m-d\TH:i:s\Z'),
                'duration' => $durationMinutes,
                'timezone' => 'UTC',
                'settings' => [
                    'join_before_host' => true,
                    'waiting_room' => false,
                ],
            ])
            ->throw()
            ->json();

        return [
            'zoom_meeting_id' => (string) $response['id'],
            'join_url' => $response['join_url'],
            'start_url' => $response['start_url'],
        ];
    }

    /**
     * Swallows a failure instead of throwing — the meeting may already be
     * gone on Zoom's side (deleted manually, expired), and that shouldn't
     * block removing our own record. Logged rather than silently dropped.
     */
    public function deleteMeeting(string $zoomMeetingId): void
    {
        try {
            $this->client()->delete("/meetings/{$zoomMeetingId}")->throw();
        } catch (\Throwable $e) {
            report($e);
        }
    }

    private function client()
    {
        return Http::baseUrl('https://api.zoom.us/v2')
            ->withToken($this->accessToken())
            ->asJson();
    }

    /**
     * Refreshes the stored token whenever it's within a minute of expiring
     * — Zoom access tokens last about an hour, and Zoom rotates the
     * refresh_token on every use, so the new pair is always persisted back
     * (the old refresh_token stops working once that happens).
     */
    private function accessToken(): string
    {
        $connection = ZoomConnection::query()->first();

        abort_if(! $connection, Response::HTTP_UNPROCESSABLE_ENTITY, 'No Zoom account is connected yet.');

        if ($connection->expires_at->subMinute()->isFuture()) {
            return $connection->access_token;
        }

        $response = Http::asForm()
            ->withBasicAuth(config('services.zoom.client_id'), config('services.zoom.client_secret'))
            ->post('https://zoom.us/oauth/token', [
                'grant_type' => 'refresh_token',
                'refresh_token' => $connection->refresh_token,
            ])
            ->throw()
            ->json();

        $this->storeTokens($response, $connection->connected_by);

        return $response['access_token'];
    }

    private function storeTokens(array $response, ?int $connectedByUserId): void
    {
        ZoomConnection::query()->delete();
        ZoomConnection::create([
            'access_token' => $response['access_token'],
            'refresh_token' => $response['refresh_token'],
            'expires_at' => now()->addSeconds($response['expires_in']),
            'connected_by' => $connectedByUserId,
        ]);
    }
}
