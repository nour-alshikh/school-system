<?php

namespace App\Http\Middleware;

use App\Enums\MembershipRole;
use App\Enums\SchoolStatus;
use App\Models\PersonalAccessToken;
use App\Models\School;
use App\Models\SchoolMembership;
use App\Models\User;
use App\Services\AuthService;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;
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

    /** A system admin inside this school as its admin (central dashboard, phase 5). */
    public const PLATFORM_SESSION = 'platform_session';

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
        $token = $user->currentAccessToken();

        if ($token instanceof PersonalAccessToken && $token->platform_session_id !== null) {
            $this->resolvePlatformSession($request, $user, $token);

            return;
        }

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
        $this->markSeen($membership);
    }

    /**
     * A system admin who entered this school: acts as its admin, for this
     * request only — the admin role is set on the user in memory, nothing
     * is written, so they never become a member. A session that ended,
     * expired, or whose user is no longer a system admin signs out (401),
     * and the BFF falls back to the platform token. Suspended schools can
     * be entered, so problems can be fixed.
     */
    private function resolvePlatformSession(Request $request, User $user, PersonalAccessToken $token): void
    {
        $session = $token->platformSession()->with('school')->first();

        if (! $session?->isOpen() || ! $user->is_platform_admin) {
            throw new AuthenticationException;
        }

        $this->context->set($session->school);
        $request->attributes->set(self::PLATFORM_SESSION, $session);
        $this->actAsAdmin($user);
    }

    /** The admin role, on this in-memory user only, for the current school. */
    public function actAsAdmin(User $user): void
    {
        $admin = Role::where('name', MembershipRole::Admin->value)->whereNull('school_id')->with('permissions')->firstOrFail();
        $user->setRelation('roles', new EloquentCollection([$admin]));
        $user->setRelation('permissions', new EloquentCollection);
    }

    /**
     * When this member was last active at the school (central dashboard,
     * phase 3). At most one write every 5 minutes per membership, not one
     * per request; a query, so no model events fire.
     */
    private function markSeen(SchoolMembership $membership): void
    {
        if ($membership->last_seen_at === null || $membership->last_seen_at->lt(now()->subMinutes(5))) {
            SchoolMembership::whereKey($membership->id)->update(['last_seen_at' => now()]);
        }
    }

    private function membershipFor(User $user): ?SchoolMembership
    {
        $token = $user->currentAccessToken();

        if ($token instanceof PersonalAccessToken && $token->school_membership_id !== null) {
            return $token->membership()->with('school')->first();
        }

        // A system admin's platform token acts as no school, even for an
        // account that is also a member somewhere.
        if ($token instanceof PersonalAccessToken && in_array(AuthService::PLATFORM_ABILITY, $token->abilities ?? [], true)) {
            return null;
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
