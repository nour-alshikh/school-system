<?php

namespace App\Services;

use App\Enums\MembershipRole;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\SchoolMembership;
use App\Models\User;
use App\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthService
{
    public function __construct(private readonly MembershipService $memberships) {}

    /**
     * @return array{user: User, token: string}
     */
    public function register(RegisterRequest $request): array
    {
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        // No role: roles are assigned per school, and a plain account has none.

        $this->establishSessionIfAvailable($request, $user);

        // A plain account belongs to no school, so its token isn't bound to one.
        return ['user' => $user, 'token' => $this->memberships->issueToken($user, null)];
    }

    /**
     * Either signs in (user + token bound to one membership), or — when the
     * account has this role at more than one school and the request didn't
     * say which — returns the schools to choose from instead.
     *
     * @return array{user: User, token: string, membership: SchoolMembership}|array{choose: Collection<int, SchoolMembership>}
     */
    public function login(LoginRequest $request): array
    {
        $user = User::where('email', $request->email)->first();

        // Checked directly against the 'web' guard's credentials, not
        // Auth::attempt() — that starts a session-backed login, but a
        // cross-domain caller (the Next.js BFF) has no session on the
        // request at all, since Sanctum only attaches one for requests it
        // recognizes as coming from a stateful (first-party) domain.
        // Same message either way — a wrong-role login shouldn't reveal
        // that the email/password were actually correct for another role.
        //
        // The role is checked against the account's memberships, not its
        // global spatie roles: a login is always "this role, at this school".
        $candidates = $user && Hash::check($request->password, $user->password)
            ? $this->memberships->usable($user, MembershipRole::from($request->role))
            : null;

        if (! $candidates?->count()) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        if ($request->filled('school_id')) {
            $membership = $candidates->firstWhere('school_id', (int) $request->school_id)
                ?? throw ValidationException::withMessages(['school_id' => __('auth.school_not_available')]);
        } elseif ($candidates->count() > 1) {
            return ['choose' => $candidates];
        } else {
            $membership = $candidates->first();
        }

        $this->establishSessionIfAvailable($request, $user);

        return ['user' => $user, 'token' => $this->memberships->issueToken($user, $membership), 'membership' => $membership];
    }

    /**
     * The user as seen from $membership's school, for a response that just
     * issued a token bound to it (login, switch-school, a new school). This
     * request was resolved for another school (or none), and roles/
     * permissions are per school, so switch before reading them.
     */
    public function userAt(User $user, SchoolMembership $membership): UserResource
    {
        app(TenantContext::class)->set($membership->school);
        $user->unsetRelation('roles')->unsetRelation('permissions');

        return new UserResource($user, $membership);
    }

    /**
     * Only a request Sanctum has recognized as stateful (first-party,
     * same-domain) carries a session at all. For everything else — in
     * particular the cross-domain BFF's server-to-server calls — this is a
     * no-op and the caller relies solely on the returned Bearer token.
     */
    private function establishSessionIfAvailable(Request $request, User $user): void
    {
        if (! $request->hasSession()) {
            return;
        }

        Auth::login($user, true);
        $request->session()->regenerate();

        $this->queueAuthStatusCookie();
    }

    public function logout(Request $request): void
    {
        $token = $request->user()?->currentAccessToken();

        // A request authenticated via a Bearer token (the cross-domain BFF
        // flow) gets a real, revocable PersonalAccessToken here. A request
        // authenticated via the first-party session cookie gets Sanctum's
        // TransientToken instead, which isn't a real DB row — fall back to
        // the usual session logout for that case.
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        } else {
            Auth::guard('web')->logout();

            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        Cookie::queue(Cookie::forget($this->authStatusCookieName()));
    }

    /**
     * Laravel's session cookie is set on every request, authenticated or not,
     * so proxy.ts can't use it to tell "logged in" from "just visited the
     * site" — it needs its own marker cookie that's only ever set here.
     */
    private function queueAuthStatusCookie(): void
    {
        Cookie::queue(Cookie::make(
            $this->authStatusCookieName(),
            '1',
            config('session.lifetime'),
            config('session.path'),
            config('session.domain'),
            config('session.secure'),
            false,
            false,
            config('session.same_site'),
        ));
    }

    private function authStatusCookieName(): string
    {
        return config('session.auth_status_cookie');
    }
}
