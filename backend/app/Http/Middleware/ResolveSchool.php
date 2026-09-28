<?php

namespace App\Http\Middleware;

use App\Models\School;
use App\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sets the current school for the request. Runs before route-model binding
 * so bound models are already school-scoped.
 *
 * Step 3 of docs/multi-tenancy.md: still hard-wired to the one existing
 * school. Step 5 replaces resolveSchool() with the authenticated user's
 * active membership (never a client-supplied header).
 */
class ResolveSchool
{
    public function __construct(private TenantContext $context) {}

    public function handle(Request $request, Closure $next): Response
    {
        $this->context->set($this->resolveSchool());

        return $next($request);
    }

    private function resolveSchool(): School
    {
        return School::query()->oldest('id')->firstOrFail();
    }
}
