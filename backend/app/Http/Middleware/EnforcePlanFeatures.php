<?php

namespace App\Http\Middleware;

use App\Platform\PlanLimits;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A module the current school's plan doesn't include answers 403 "Not
 * included in your plan" (docs/central-dashboard-plan.md, phase 9). One
 * map of paths per module instead of a middleware on every route group,
 * so a new route under a module's paths is covered automatically. A system
 * admin inside a school isn't limited: they may be there to fix it.
 */
class EnforcePlanFeatures
{
    /** Module => its API paths (Request::is() patterns). */
    public const PATHS = [
        'fees' => ['api/fees', 'api/fees/*', 'api/fee-charges/*', 'api/parent/fees', 'api/student/fees', 'api/students/*/fee-charges'],
        'exams' => ['api/exams', 'api/exams/*', 'api/student/exams', 'api/student/exams/*'],
        'meetings' => ['api/meetings', 'api/meetings/*', 'api/student/meetings', 'api/zoom/connection', 'api/zoom/connect-url', 'api/zoom/status'],
        'library' => ['api/library-resources', 'api/library-resources/*', 'api/parent/library-resources', 'api/student/library-resources'],
        // AI drafts; AiAccess checks it too, for a system admin inside the school.
        'ai' => ['api/ai/*'],
    ];

    public function __construct(private readonly PlanLimits $limits) {}

    public function handle(Request $request, Closure $next): Response
    {
        $plan = $request->attributes->has(ResolveSchool::PLATFORM_SESSION) ? null : $this->limits->plan();

        if ($plan !== null) {
            foreach (self::PATHS as $feature => $patterns) {
                if ($request->is(...$patterns) && ! $plan->includes($feature)) {
                    abort(Response::HTTP_FORBIDDEN, __('api.plan_feature_missing'));
                }
            }
        }

        return $next($request);
    }
}
