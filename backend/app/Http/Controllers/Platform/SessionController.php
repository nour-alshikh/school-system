<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Http\Middleware\ResolveSchool;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\PersonalAccessToken;
use App\Models\PlatformSession;
use App\Models\School;
use App\Platform\AuditLogResource;
use App\Platform\PlatformSessions;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Entering a school as its admin, and coming back
 * (docs/central-dashboard-plan.md, phase 5).
 */
class SessionController extends Controller
{
    public function __construct(private readonly PlatformSessions $sessions) {}

    /** Sudo mode: a fresh code, good for 10 minutes, before entering a school. */
    public function confirm(Request $request): Response
    {
        $request->validate(['code' => ['required', 'string', 'max:10']]);

        $this->sessions->confirm($request->user(), $request->user()->currentAccessToken(), $request->input('code'));

        return response()->noContent();
    }

    /**
     * Answers like a login: the user as admin of $school, and a token bound
     * to the session. The BFF keeps the platform token aside to come back.
     */
    public function enter(Request $request, School $school): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $user = $request->user();

        ['session' => $session, 'token' => $token] = $this->sessions->enter(
            $user, $user->currentAccessToken(), $school, $data['reason'] ?? null,
        );

        // Build the response as it will look inside: the school, as admin.
        // The session goes on the request only while the user is rendered —
        // this request itself was made with the platform token, so it must
        // not be audited as one made inside the school.
        app(TenantContext::class)->set($school);
        $request->attributes->set(ResolveSchool::PLATFORM_SESSION, $session->load('school'));
        app(ResolveSchool::class)->actAsAdmin($user);
        $response = response()->json(['user' => new UserResource($user), 'token' => $token], 201);
        $request->attributes->remove(ResolveSchool::PLATFORM_SESSION);

        return $response;
    }

    /** Ends the session (called with the session's own token). */
    public function exit(Request $request): Response
    {
        $token = $request->user()->currentAccessToken();

        abort_unless($token instanceof PersonalAccessToken && $token->platform_session_id !== null, 403, __('api.unauthorized'));

        $this->sessions->exit($token);

        return response()->noContent();
    }

    /**
     * For a school's admins: what system admins did in their school —
     * sessions opened and closed, and every request made during them.
     */
    public function schoolActivity(Request $request): JsonResponse
    {
        $school = app(TenantContext::class)->school();

        $logs = AuditLog::with('actor:id,name,email')
            ->where('school_id', $school->id)
            ->latest('id')
            ->paginate(50);

        return response()->json([
            'audit_logs' => collect($logs->items())->map(fn (AuditLog $log) => AuditLogResource::from($log))->all(),
            'sessions' => PlatformSession::with('user:id,name,email')
                ->where('school_id', $school->id)
                ->latest('started_at')
                ->take(20)
                ->get()
                ->map(fn (PlatformSession $s) => [
                    'id' => $s->id,
                    'user' => $s->user?->only(['id', 'name', 'email']),
                    'reason' => $s->reason,
                    'started_at' => $s->started_at->toJSON(),
                    'ended_at' => $s->ended_at?->toJSON(),
                    'open' => $s->isOpen(),
                ])
                ->all(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }
}
