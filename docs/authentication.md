# Authentication

Token-based SPA authentication via [Laravel Sanctum](https://laravel.com/docs/sanctum),
brokered through a Next.js BFF (Backend for Frontend) — not a shared-domain session
cookie, because frontend and backend live on unrelated domains in this deployment
(`*.vercel.app` and `*.reeras.site`).

## Why a BFF, not a shared-domain cookie

Sanctum's SPA cookie mode (its usual recommended setup) requires frontend and backend
to share a top-level domain — the session cookie is scoped to that domain and browsers
won't send it cross-site. That's not the case here, so instead:

- Laravel issues a Sanctum **personal access token** on login/register, in addition to
  (optionally) a session.
- The **browser never sees that token**. It only ever talks to Next.js route handlers
  on its own origin, which hold the token server-side in an `httpOnly` cookie and
  replay it as `Authorization: Bearer <token>` on every request to Laravel.

This sidesteps both cross-site cookie blocking and the classic JWT-in-JS XSS risk —
the token lives in an httpOnly cookie the frontend's own JS can't read either.

If frontend and backend ever end up sharing a top-level domain, the plain cookie mode
still works with zero backend changes — see [How it works](#how-it-works) below, the
backend supports both simultaneously.

## How it works

```
Browser (school-system-neon.vercel.app)
  │
  │  fetch("/api/...", { credentials: "include" })   ← same-origin, no CORS
  ▼
Next.js BFF (src/app/api/[...path]/route.ts)
  │  reads sanctum_token httpOnly cookie
  │  → Authorization: Bearer <token>
  ▼
Laravel API (school-system.noor.reeras.site)
  │  Sanctum: auth:sanctum guard (accepts Bearer tokens)
  ▼
Authenticated request
```

1. `POST /api/register` / `POST /api/login` hit the BFF, which forwards to Laravel.
   Laravel creates/checks the user and returns `{ user, token }` — `token` is a
   fresh Sanctum personal access token (`$user->createToken('spa')`).
2. The BFF route handler (`frontend/src/app/api/[...path]/route.ts`) strips `token`
   out of the response before it reaches the browser, and instead sets it as an
   `httpOnly`, `Secure`, `SameSite=Lax` cookie (`sanctum_token`) scoped to the
   frontend's own domain. It also sets a second, non-`httpOnly` marker cookie
   (`auth_status`) — same role as before, see point 5 below.
3. Every other frontend request (`GET /api/user`, `POST /api/posts`, etc.) goes to
   the same catch-all route handler, which reads `sanctum_token` and attaches it as
   `Authorization: Bearer <token>` before forwarding to Laravel. `auth:sanctum`
   accepts this natively — no backend routing changes were needed for any endpoint.
4. Logout calls `POST /api/logout`. Laravel deletes the `PersonalAccessToken` row
   server-side (`$request->user()->currentAccessToken()->delete()`), and the BFF
   clears both cookies.
5. `auth_status` still exists for the same reason as before: `proxy.ts` needs a
   cheap, JS/edge-readable way to tell "logged in" from "not", and can't read the
   httpOnly token cookie. It's set/cleared by the BFF now instead of by Laravel.

The Laravel API is the only thing that actually enforces authentication. Neither the
BFF nor `proxy.ts`'s redirect are a security boundary — see
[authorization.md](./authorization.md#enforcement-boundary) for why that distinction
matters more once roles are involved.

### The same-domain cookie path still exists, unused by this app

`AuthService::login`/`register` only start a Laravel session (`Auth::login` +
`session()->regenerate()`) when `$request->hasSession()` is true. Sanctum only
attaches a session to the request when it recognizes the caller as a first-party,
stateful-domain request (matched against `SANCTUM_STATEFUL_DOMAINS` via `Origin`/
`Referer`). The BFF's server-to-server calls never match that, so in this deployment
every login is token-only — the session branch is dead code for this app, but it's
what activates automatically if something else (a same-domain deployment, a
different stateful client) calls the API directly with the browser's cookies.
`AuthService::logout` mirrors this: it deletes a real `PersonalAccessToken` when
auth was via Bearer, or does the old session logout when Sanctum handed it a
`TransientToken` (session-authenticated).

## Backend (`backend/`)

- `config/sanctum.php` — `stateful` domains; irrelevant to the BFF's Bearer-token
  calls, only matters for the direct-cookie path described above.
- `config/cors.php` — `supports_credentials: true`, origins read from `FRONTEND_URLS`.
  Also irrelevant to the BFF (server-to-server calls aren't subject to CORS); only
  matters if a browser ever calls Laravel directly.
- `app/Services/AuthService.php` — issues the Sanctum token on every register/login,
  starts a session only when one is available (see above), revokes the token or the
  session on logout depending on which authenticated the request.
- `app/Http/Controllers/Auth/AuthController.php` — `register`, `login`, `logout`,
  `user` endpoints; `register`/`login` responses include `token`.
- `routes/api.php` — route definitions, including the `throttle:10,1` guard on
  register/login. All protected routes use `auth:sanctum`, which accepts Bearer
  tokens natively — nothing here changed for the BFF.

Forgot/reset password is a separate flow built on top of this — see
[password-reset.md](./password-reset.md).

Env vars that matter (see `.env.example`):

```
APP_URL=https://school-system.noor.reeras.site   # must be the real public URL —
                                                  # feeds absolute URLs Laravel
                                                  # generates, e.g. avatar URLs
SESSION_DOMAIN=localhost          # only matters for the unused session path above
SESSION_COOKIE=app_session
AUTH_STATUS_COOKIE=auth_status    # not used by this deployment's frontend anymore —
                                  # the BFF sets its own auth_status cookie instead
SANCTUM_STATEFUL_DOMAINS=localhost:3000
FRONTEND_URLS=https://school-system-neon.vercel.app
```

## Frontend (`frontend/`)

- `src/app/api/[...path]/route.ts` — the BFF itself. Catch-all proxy: forwards every
  `/api/*` request to Laravel with the Bearer token attached, special-cases
  login/register (extract token → cookie) and logout (clear cookies).
- `src/lib/api.ts` — fetch wrapper: same-origin relative paths, `credentials:
  "include"` (to send the BFF's own cookies), no CSRF handling needed (Bearer auth
  isn't CSRF-vulnerable the way cookie sessions are).
- `src/contexts/auth-context.tsx` — `AuthProvider` / `useAuth()`. Hydrates the
  current user from `GET /api/user` on mount, exposes `login`, `register`, `logout`.
  Unchanged by the BFF switch — it already only spoke to relative `/api/...` paths.
- `src/proxy.ts` — this Next.js version renamed `middleware.ts` to `proxy.ts`
  (v16+). Redirects based on **`auth_status` cookie presence only** — it can't
  inspect the opaque token, so it's a UX shortcut, not enforcement. Protects
  `/dashboard` and `/admin`; keeps `/login` and `/register` guest-only.
- `src/app/login`, `src/app/register`, `src/app/dashboard` — example pages using
  `useAuth()`.

Forgot/reset password pages are covered in
[password-reset.md](./password-reset.md), not here.

Env vars (see `.env.example`):

```
LARAVEL_API_URL=http://localhost:8000        # server-only — the BFF's fetch target.
                                              # No NEXT_PUBLIC_ prefix: the browser
                                              # must never see the Laravel origin
                                              # directly, only /api/* on its own domain.
NEXT_PUBLIC_AUTH_STATUS_COOKIE=auth_status   # must match the BFF's cookie name
```

## Running locally

```bash
# backend
cd backend
php artisan migrate --seed
php artisan serve --port=8000

# frontend (separate terminal)
cd frontend
npm run dev
```

Visit `http://localhost:3000/register` to create an account, or use the seeded
`test@example.com` / `password` user (role `user`) from `php artisan migrate --seed`.
Locally the frontend still goes through the BFF (same code path as production) —
`LARAVEL_API_URL=http://localhost:8000` in `frontend/.env.local` is what points it
at the local Laravel server.

## Beyond this setup

- **Frontend and backend end up on the same top-level domain**: no code changes
  needed. The moment a browser calls Laravel directly, Sanctum recognizes it as a
  stateful request and `AuthService` automatically also does the full session login
  — both paths are already live in the backend.
- **Mobile app**: issue a Sanctum personal access token exactly the same way this
  BFF does (`$user->createToken(...)`, already available via `HasApiTokens` on the
  `User` model). Runs against the same backend, same users, no conflict with either
  the BFF's or a same-domain SPA's auth.
