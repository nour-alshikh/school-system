<?php

namespace App\Http\Middleware;

use App\Models\PersonalAccessToken;
use App\Services\AuthService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Platform routes: a platform admin, signed in through the system admin
 * login (two-factor), not through a school. A school token never passes,
 * even for an account that is also a platform admin. Checked on the
 * token's own ability list: Sanctum's tokenCan() would also accept a "*"
 * school token. See docs/central-dashboard-plan.md, phase 1.
 */
class EnsurePlatformAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $token = $user?->currentAccessToken();

        abort_unless(
            $user?->is_platform_admin
                && $token instanceof PersonalAccessToken
                && in_array(AuthService::PLATFORM_ABILITY, $token->abilities ?? [], true),
            Response::HTTP_FORBIDDEN,
            __('api.unauthorized'),
        );

        return $next($request);
    }
}
