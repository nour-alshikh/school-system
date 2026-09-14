<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

/**
 * The Next.js BFF forwards the active frontend locale as Accept-Language
 * (see frontend/src/app/api/[...path]/route.ts) — a plain locale code, not
 * an RFC 4647 preference list, so this is a direct lookup rather than
 * content negotiation.
 */
class SetLocale
{
    private const SUPPORTED_LOCALES = ['en', 'ar'];

    public function handle(Request $request, Closure $next): Response
    {
        $locale = $request->header('Accept-Language');

        if ($locale && in_array($locale, self::SUPPORTED_LOCALES, true)) {
            App::setLocale($locale);
        }

        return $next($request);
    }
}
