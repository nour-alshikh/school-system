<?php

namespace App\Services;

use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthService
{
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

        $user->assignRole('user');

        $this->establishSessionIfAvailable($request, $user);

        return ['user' => $user, 'token' => $this->issueToken($user)];
    }

    /**
     * @return array{user: User, token: string}
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
        if (! $user || ! Hash::check($request->password, $user->password) || ! $user->hasRole($request->role)) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        $this->establishSessionIfAvailable($request, $user);

        return ['user' => $user, 'token' => $this->issueToken($user)];
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
        if ($token instanceof \Laravel\Sanctum\PersonalAccessToken) {
            $token->delete();
        } else {
            Auth::guard('web')->logout();

            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        Cookie::queue(Cookie::forget($this->authStatusCookieName()));
    }

    /**
     * Issued alongside the session on every register/login so a caller that
     * can't share the session cookie (a cross-domain frontend acting as its
     * own BFF) can use Bearer auth instead. The session-based frontend just
     * ignores this field.
     */
    private function issueToken(User $user): string
    {
        return $user->createToken('spa')->plainTextToken;
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
