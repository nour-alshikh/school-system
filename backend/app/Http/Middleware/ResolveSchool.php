<?php

namespace App\Http\Middleware;

use App\Enums\SchoolStatus;
use App\Models\PersonalAccessToken;
use App\Models\School;
use App\Models\SchoolMembership;
use App\Models\User;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sets the current school for the request. Runs before route-model binding
 * so bound models are already school-scoped. See docs/multi-tenancy.md.
 *
 * - Signed in: the school of the membership the token was issued for.
 *   Never a client-supplied value.
 * - Otherwise, on a public route (login page, public settings): the school
 *   named by the BFF's X-School slug if any, else the default school. Only
 *   public branding lives there.
 * - Otherwise (a plain account with no school, behind auth:sanctum): no
 *   school at all, so school-owned data answers 403.
 */
class ResolveSchool
{
    /** Request attribute holding the membership a signed-in request acts as. */
    public const MEMBERSHIP = 'school_membership';

    public function __construct(
        private readonly TenantContext $context,
        private readonly MembershipService $memberships,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        // Fresh per request even where the container outlives one (tests,
        // Octane) — a previous request's school must never carry over.
        $this->context->clear();

        $user = $request->user('sanctum');

        if ($user instanceof User) {
            $this->resolveForUser($request, $user);
        }

        if (! $this->context->has() && $this->isPublicRoute($request)) {
            $school = $this->schoolFromHint($request) ?? $this->defaultSchool();

            if ($school) {
                $this->context->set($school);
            }
        }

        return $next($request);
    }

    private function resolveForUser(Request $request, User $user): void
    {
        $membership = $this->membershipFor($user);

        // A plain account (registered, no school): see handle().
        if ($membership === null) {
            return;
        }

        // Revoked/suspended since the token was issued: treat as signed out
        // so the frontend drops the session instead of looping on 403s.
        if ($membership->user_id !== $user->id || ! $this->memberships->isUsable($membership)) {
            throw new AuthenticationException;
        }

        $hint = $request->header('X-School');
        abort_if($hint !== null && $hint !== $membership->school->slug, Response::HTTP_FORBIDDEN, __('api.school_mismatch'));

        $this->context->set($membership->school);
        $request->attributes->set(self::MEMBERSHIP, $membership);
    }

    private function membershipFor(User $user): ?SchoolMembership
    {
        $token = $user->currentAccessToken();

        if ($token instanceof PersonalAccessToken && $token->school_membership_id !== null) {
            return $token->membership()->with('school')->first();
        }

        // Tokens issued before memberships existed, and session logins:
        // unambiguous only when the account has exactly one membership.
        $usable = $this->memberships->usable($user);

        return $usable->count() === 1 ? $usable->first() : null;
    }

    private function isPublicRoute(Request $request): bool
    {
        return ! in_array('auth:sanctum', $request->route()?->gatherMiddleware() ?? [], true);
    }

    private function schoolFromHint(Request $request): ?School
    {
        $slug = $request->header('X-School');

        return $slug === null ? null : School::where('slug', $slug)->where('status', SchoolStatus::Active)->first();
    }

    private function defaultSchool(): ?School
    {
        return School::where('status', SchoolStatus::Active)->oldest('id')->first();
    }
}
