<?php

namespace App\Http\Middleware;

use App\Demo\Sandboxes;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Demo deployments only (config demo.enabled): runs the request against
 * the visitor's own copy of the demo data, named by the X-Demo-Sandbox
 * header the BFF sends (a random id it keeps in an httpOnly cookie). Global
 * and early, so nothing touches the database before the switch. Without a
 * valid id the request is refused rather than run against the shared
 * template. See docs/demo-sandboxes.md.
 */
class UseDemoSandbox
{
    public const HEADER = 'X-Demo-Sandbox';

    public function __construct(private readonly Sandboxes $sandboxes) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! config('demo.enabled') || $request->is('up')) {
            return $next($request);
        }

        $id = $request->headers->get(self::HEADER);

        if (! Sandboxes::validId($id)) {
            return response()->json(['message' => 'This demo needs its session: open it from the demo site.'], 400);
        }

        if (! $this->sandboxes->templateExists()) {
            return response()->json(['message' => 'The demo is being set up. Try again in a minute.'], 503);
        }

        $this->sandboxes->activate($id);

        return $next($request);
    }
}
