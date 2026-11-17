<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Every browser request reaches the API through the Next.js BFF
 * (docs/authentication.md), so REMOTE_ADDR is the BFF's address, not the
 * visitor's — and every per-address limit (signup, "Describe your school",
 * login) would count all visitors together. The BFF sends the visitor's
 * address in X-Client-IP with a shared secret (services.bff.secret); with a
 * matching secret, that address becomes the request's IP.
 *
 * A secret instead of TrustProxies: the BFF runs on Vercel, whose outgoing
 * addresses aren't fixed, so trusting it by address isn't possible. Without
 * the secret (not configured, or a request that didn't come from the BFF)
 * the header is ignored, so it can't be used to dodge limits.
 */
class TrustBffClientIp
{
    public const IP_HEADER = 'X-Client-IP';

    public const SECRET_HEADER = 'X-BFF-Secret';

    public function handle(Request $request, Closure $next): Response
    {
        $secret = (string) config('services.bff.secret');
        $sent = (string) $request->headers->get(self::SECRET_HEADER);
        $ip = (string) $request->headers->get(self::IP_HEADER);

        if ($secret !== '' && $sent !== '' && hash_equals($secret, $sent) && filter_var($ip, FILTER_VALIDATE_IP)) {
            $request->server->set('REMOTE_ADDR', $ip);
        }

        // Never passed on: the secret mustn't end up in logs or exception reports.
        $request->headers->remove(self::SECRET_HEADER);
        $request->server->remove('HTTP_X_BFF_SECRET');

        return $next($request);
    }
}
