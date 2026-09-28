<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Platform routes (creating/suspending schools): users.is_platform_admin
 * only. Independent of the school the request is signed in to.
 */
class EnsurePlatformAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->is_platform_admin, Response::HTTP_FORBIDDEN, __('api.unauthorized'));

        return $next($request);
    }
}
