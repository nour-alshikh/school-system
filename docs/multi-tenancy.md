# Multi-Tenancy Migration Plan (Option 2: DB-per-tenant)

Status: proposal, not implemented. Current app is single-tenant — no `school_id`/
`tenant_id` column anywhere, one shared DB (SQLite locally, presumably MySQL/Postgres
in prod via `DB_CONNECTION`).

This plan converts to **one database per school**, using
[`stancl/tenancy`](https://tenancyforlaravel.com/) v3 (the standard Laravel package
for this — don't hand-roll it, connection-switching + queue/storage/cache isolation
has a lot of edge cases it already solves).

## Why DB-per-tenant over shared-DB-with-`school_id`

- Full data isolation — no risk of a missed `WHERE school_id = ?` leaking one school's
  students/fees into another's response.
- Per-school backup/restore/export/delete is trivial (dump/drop one DB).
- `spatie/laravel-permission` roles/permissions table doesn't need the `teams` hack —
  each tenant DB has its own roles table, scoped for free.
- Cost: heavier ops (migrations run once per tenant DB, more connections), and cross-
  tenant reporting/analytics gets harder (needs a fan-out query or a read replica that
  aggregates across tenant DBs).

## Complication specific to this app: the BFF

Per [authentication.md](./authentication.md), frontend and backend are on **unrelated
domains** — a Next.js BFF (`frontend/src/app/api/[...path]/route.ts`) proxies every
request to a single Laravel origin, holding the Sanctum token server-side. There's no
browser-to-Laravel direct connection today, and no per-tenant subdomain on the
Laravel side.

That rules out `stancl/tenancy`'s default **domain-based** tenant identification
(`InitializeTenancyByDomain`) unless Laravel itself grows per-school subdomains
(`schoolA.school-system.reeras.site`) and the BFF is taught to route to them — bigger
change. Simpler path for this architecture:

- Each school gets a slug (`acme-academy`), surfaced on the frontend as its own
  subdomain or path prefix (`acme-academy.vercel.app`, or a `/t/acme-academy` prefix
  in the BFF route).
- The BFF resolves the tenant slug from that and forwards it to Laravel as a header,
  e.g. `X-Tenant: acme-academy`, on every proxied request.
- Laravel uses `stancl/tenancy`'s `InitializeTenancyByRequestData` (or a small custom
  identification middleware reading that header) instead of by-domain.

This keeps the "browser never talks to Laravel directly" property intact and needs no
new public DNS/subdomains on the Laravel side.

## Migration steps

### 1. Central DB (new)

A small DB that lists tenants, separate from any tenant's data:

```
tenants          id, slug, name, db_name, status, created_at...
domains          (if/when direct-domain routing is added later — skip for now)
```

`stancl/tenancy` ships the `Tenant` model + migration for this; extend it with
`slug`, `name`, whatever central-admin fields you want (subscription plan, etc).

### 2. Split migrations into central vs tenant

Everything in `backend/database/migrations/` today — `users`, `personal_access_tokens`,
`permission_tables`, `posts`, `stages`, `grades`, `classrooms`, `students`, `teachers`,
`fees`, `exams`, `attendance`, `calendar_events`, `meetings`, all of it — moves to
`database/migrations/tenant/`. Only the new `tenants` table (and any future central-
admin-only tables) stays in `database/migrations/` (central).

`php artisan tenants:migrate` runs the tenant set against every tenant DB;
`php artisan migrate` runs the central set.

### 3. Users, auth, roles all become tenant-scoped

- `User`, `PersonalAccessToken` (Sanctum), `roles`/`permissions`
  (spatie/laravel-permission) all move to tenant DBs — a login belongs to exactly one
  school.
- Means: tenancy must be initialized **before** the `auth:sanctum` middleware runs, so
  Sanctum resolves the token against the right tenant DB. Middleware order in
  `bootstrap/app.php` / `routes/api.php`: `InitializeTenancyByRequestData` (or your
  header-based equivalent) → `auth:sanctum`.
- Login flow needs the tenant slug *before* authenticating — the frontend must know
  which school it's on before calling `/api/login` (from the subdomain/path, not from
  a login form field), otherwise you can't find the right `users` table to check the
  password against.
- Central "platform admin" (you, managing schools) is a separate concern — either a
  small separate guard reading straight from the central DB, or its own tiny app.

### 4. Storage & media isolation

`spatie/laravel-medialibrary` writes to disk paths keyed by model ID today — those IDs
can collide across tenants once DBs are separate. Add `stancl/tenancy`'s filesystem
tenancy bootstrapper so each tenant's media lives under its own storage prefix
(`tenant-{id}/...`), and set `MEDIA_DISK` per tenant if schools should get isolated
storage buckets too.

### 5. Queues & cache

Any queued job (e.g. Zoom integration, notifications) needs to know which tenant DB to
run against when it executes later — enable `stancl/tenancy`'s queue bootstrapper so
the tenant context is serialized onto the job and re-initialized on the worker. Same
idea for cache keys if `cache` is shared infra (Redis) across tenants — prefix by
tenant to avoid collisions.

### 6. Tenant provisioning flow

New school signup/creation needs to, in order:
1. Insert `tenants` row (central DB).
2. Create the tenant's physical DB.
3. Run tenant migrations against it (`tenants:migrate`).
4. Seed default roles/permissions + an initial admin `User` for that school.
5. (Optional) queue this instead of doing it synchronously in the request — DB
   creation + migration can take a few seconds.

`stancl/tenancy` fires `TenantCreated` — hook steps 2-4 onto that event.

### 7. Frontend changes

- Resolve tenant slug from subdomain (or path) on every request.
- BFF route handler (`route.ts`) reads that and adds `X-Tenant` (or whatever header
  name) before forwarding to Laravel — one-line change to the existing proxy, no new
  auth model needed on the frontend side.
- Login/register pages need the tenant context available before submit (can't ask the
  user to type their school on the login form and also identify tenant from URL —
  pick one; URL-based is what stancl/tenancy expects).

### 8. Local dev

`stancl/tenancy` supports SQLite tenants (one `.sqlite` file per tenant) — fits this
repo's current `DB_CONNECTION=sqlite` default well for local dev, even if prod uses
MySQL/Postgres tenant DBs. Lets you spin up two fake schools locally without a real
DB server.

## Rollout order (suggested)

1. Install `stancl/tenancy`, central `tenants` table, no behavior change yet
   (single hardcoded tenant, feature-flagged).
2. Move all existing migrations to `database/migrations/tenant/`, get
   `tenants:migrate` working against one seeded tenant DB — app still behaves
   single-tenant, just now DB-per-tenant with 1 tenant.
3. Wire up request-header tenant identification + BFF header forwarding.
4. Add tenant provisioning flow (steps in §6).
5. Add filesystem/queue bootstrappers (§4, §5).
6. Build minimal central-admin surface for creating/suspending schools.
7. Only then open up self-serve signup, if that's ever a goal.

Each step above is independently shippable and testable — don't do this as one big
migration.
