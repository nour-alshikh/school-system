<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Records every request a system admin makes while inside a school
 * (docs/central-dashboard-plan.md, phase 5): method, route, status, and
 * for writes which fields were sent (names only, never values). The
 * school's admins see these in their "System admin activity" page.
 */
class AuditPlatformSession
{
    /** Never recorded, not even by name. */
    private const HIDDEN = ['password', 'password_confirmation', 'current_password', 'token', 'code', 'recovery_code'];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $session = $request->attributes->get(ResolveSchool::PLATFORM_SESSION);

        if ($session !== null) {
            $isWrite = ! $request->isMethodSafe();

            AuditLog::record('platform.request', $session, array_filter([
                'method' => $request->method(),
                'path' => '/'.$request->path(),
                'route' => $request->route()?->uri(),
                'status' => $response->getStatusCode(),
                'fields' => $isWrite ? array_values(array_diff(array_keys($request->except(self::HIDDEN)), self::HIDDEN)) : null,
                'files' => $isWrite && $request->allFiles() ? array_keys($request->allFiles()) : null,
            ], fn ($v) => $v !== null && $v !== []), $session->school);
        }

        return $response;
    }
}
