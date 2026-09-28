<?php

namespace App\Http\Controllers;

use App\Models\School;
use App\Models\ZoomConnection;
use App\Services\ZoomService;
use App\Tenancy\TenantContext;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ZoomController extends Controller
{
    public function __construct(private readonly ZoomService $zoom) {}

    /**
     * Readable by anyone who can reach /meetings (teacher or
     * manage-meetings) — a teacher without manage-meetings can't connect
     * or disconnect the shared account, but still needs to know whether
     * one exists before trying to schedule something.
     */
    public function status(Request $request)
    {
        $connection = ZoomConnection::with('connectedByUser')->first();

        return response()->json([
            'connected' => (bool) $connection,
            'connected_by' => $connection?->connectedByUser?->name,
        ]);
    }

    /**
     * manage-meetings only (see routes/api.php) — returns the URL the
     * frontend redirects the browser to (a full top-level navigation to
     * zoom.us, not something a fetch() can follow). The current user's id
     * rides along in `state` (see ZoomService::authorizeUrl()) since
     * callback() below has no session to read it from.
     */
    public function connectUrl(Request $request)
    {
        return response()->json([
            'url' => $this->zoom->authorizeUrl(app()->getLocale(), $request->user()->id),
        ]);
    }

    /**
     * Zoom redirects the browser here directly (not through the frontend)
     * once the host approves — this exchanges the code for a token pair
     * and then bounces the browser on to the frontend's meetings page.
     * Same "redirect to the frontend, not a Laravel view" idea as
     * AppServiceProvider's password-reset URL.
     *
     * Deliberately outside auth:sanctum (see routes/api.php) — this is a
     * plain top-level navigation from zoom.us, whose Referer is zoom.us,
     * not our frontend, so Sanctum's cookie-based "fromFrontend" check
     * would never pass here. Legitimacy comes from `state` matching what
     * connectUrl() generated, not from a session — see
     * ZoomService::resolveState().
     */
    public function callback(Request $request)
    {
        abort_if(! $request->query('code'), Response::HTTP_BAD_REQUEST, 'Zoom did not return an authorization code.');

        // resolveState() consumes the token (Cache::pull) — read it exactly
        // once, since a second call would always come back null and reject
        // a perfectly valid callback.
        $state = $this->zoom->resolveState((string) $request->query('state'));
        abort_if($state === null, Response::HTTP_FORBIDDEN, 'Invalid or expired connect request.');

        $school = School::findOrFail($state['school_id']);
        app(TenantContext::class)->runAs($school, fn () => $this->zoom->connect($request->query('code'), $state['user_id']));

        $frontendUrl = rtrim(config('cors.allowed_origins')[0] ?? 'http://localhost:3000', '/');

        return redirect("{$frontendUrl}/{$state['locale']}/meetings?zoom=connected");
    }

    public function disconnect(Request $request)
    {
        $this->zoom->disconnect();

        return response()->noContent();
    }
}
