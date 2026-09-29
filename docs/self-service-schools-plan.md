# Self-Service Schools Plan

Status: **phases 1–2 done** (2026-09-29; phase 1 includes the `school-signup` rate
limit); phases 3–5 planned (written 2026-09-29). Builds on
[multi-tenancy.md](./multi-tenancy.md) (steps 1–8 are done). Related:
[central-dashboard-plan.md](./central-dashboard-plan.md),
[demo-seeder-plan.md](./demo-seeder-plan.md).

## Goal

Anyone can create a school from the public site and start using it right away as its
admin, without a system admin being involved.

Decisions made (2026-09-29):

| Question | Decision |
|---|---|
| Who can create a school? | **Anyone** (no invite code) |
| Does a new school need approval? | **No — live immediately** (status `active`) |

## What exists today

| Piece | State |
|---|---|
| `SchoolProvisioner::create($name, $slug, $adminName, $adminEmail)` | Creates the school, its default settings and an admin membership (via `MembershipService::grant()`). A new email gets an account with a random password and a set-your-password email. |
| `POST /api/platform/schools` | System admin only. Validates the slug (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, max 63, unique). |
| `POST /api/register` | Creates a **plain account with no school**. Its token isn't bound to a membership, so school data answers 403. On its own the account can't do anything. |
| BFF (`frontend/src/app/api/[...path]/route.ts`) | Captures the token into the cookie for `login`, `register`, `switch-school`. |
| Email verification | Not used (`MustVerifyEmail` is commented out on `User`). Mail isn't configured ([gaps.md](./gaps.md)). |
| Onboarding | None. A new school is empty: no years, stages, grades, classrooms or subjects. |

The core already exists in the provisioner. This plan adds a public entry point, abuse
protection and a first-run setup.

## Recommendations built into this plan

1. **Two entry points, one service.** A guest signs up (account and school in one form).
   A logged-in user adds a school to their existing account. Both call the
   provisioner.
2. **The creator is logged in as the new school's admin right away.** The response
   includes a token bound to the new membership, the same as login or switch-school. They
   never see the login page or a school picker.
3. **Going live immediately needs guard rails instead of approval:** strict throttling,
   a honeypot field, a cap on schools per account, reserved slugs, and email
   verification before the school can **send email to other people** (invitations,
   password resets for its users). The school itself works before verification. Only
   outgoing mail waits, so the app can't be used to send spam.
4. **Record where each school came from** (`created_by_id`, `source`), so the central
   dashboard can list, filter and, if needed, suspend self-service schools.
5. **A setup checklist on the admin dashboard** guides a new school through the
   structure it needs before anything else works.
6. **A school owner can't delete their school.** Archive and purge stay system admin
   actions ([central-dashboard-plan.md](./central-dashboard-plan.md), phase 7).

## Phases

Rough sizes: S ≈ half a day, M ≈ 1–2 days, L ≈ 3–5 days.

| # | Phase | Size | Depends on |
|---|---|---|---|
| 1 | Backend: provisioning for an owner, signup endpoints, slug rules | M | — |
| 2 | Frontend: "Create your school" page and entry links | M | 1 |
| 3 | Abuse protection + email verification gate | S–M | 1 |
| 4 | Setup checklist (onboarding) | M | 1 |
| 5 | Hooks into the central dashboard | S | dashboard phases 2, 4, 9 |

Phases 1–4 don't depend on either of the other plans and can ship first.

---

## Phase 1 — Backend

**Schema** (migration on `schools`):

- `created_by_id` — nullable FK to `users` (null for schools created by a system admin
  or a seeder).
- `source` — enum `platform | self_service | seed`, default `platform`. Backfill
  existing rows as `platform`.

**Provisioner**

- Add `SchoolProvisioner::createForOwner(User $owner, string $name, string $slug): array{school, membership}`.
  Runs in the same transaction as `create()`: the school, default settings
  (`school_name` = name, `email` = owner's email), and
  `MembershipService::grant($owner, MembershipRole::Admin)`. **No invitation email**,
  because the owner already has a password. Sets `created_by_id` and
  `source = self_service`.
- Pull the shared part (school + settings + grant) into one private method so
  `create()` and `createForOwner()` can't drift apart.

**Slug rules** — one rule class, `App\Rules\SchoolSlug`, used by the platform endpoint
and both new ones:

- the existing regex, 3–63 characters, unique in `schools`;
- a reserved list (config `schools.reserved_slugs`): `admin`, `api`, `app`, `platform`,
  `system`, `login`, `register`, `create-school`, `www`, `mail`, `support`, `help`,
  `demo`, `test`, `static`, `assets`…

**Endpoints**

| Route | Auth | Body | Does |
|---|---|---|---|
| `POST /api/school-signup` | guest, `throttle:school-signup` | `name`, `email`, `password`, `password_confirmation`, `school_name`, `slug`, `website` (honeypot) | Creates the user (same rules as `RegisterRequest`) and the school in **one transaction**. Returns `{ user, token }`, with the token bound to the new admin membership. |
| `POST /api/schools` | `auth:sanctum`, `throttle:school-signup` | `school_name`, `slug` | Adds a school to the current user. Returns `{ user, token }` bound to the new membership and revokes the current token, the same as `switch-school`. |
| `GET /api/school-slugs/{slug}` | public, `throttle:30,1` | — | `{ available: bool, reason?: 'taken' \| 'reserved' \| 'invalid' }`, for the live check in the form. |

- Controller: `App\Http\Controllers\SchoolSignupController` (not under `Platform\`).
  FormRequests: `SchoolSignupRequest` and `CreateSchoolRequest`.
- The response user comes from the same `userAt()` logic as `AuthController`:
  switch `TenantContext` to the new school and build `UserResource($user, $membership)`.
  Move `userAt()` somewhere both controllers can use it (e.g. `AuthService`).
- `POST /api/school-signup` works while a user is logged in too. It's still a new
  account, so the email must be unused. The frontend sends logged-in users to the
  other form.

**BFF**

- Add `school-signup` and `schools` (POST only) to the token-capturing paths in
  `frontend/src/app/api/[...path]/route.ts`, so the cookie is set or swapped as on login.

## Phase 2 — Frontend

- **Page `/[locale]/create-school`** (`features/school-signup/`):
  - Guest: two sections: *Your school* (name, address slug) and *Your account*
    (name, email, password, confirm). A link says "Already have an account? Log in to
    add a school", and after login the user returns here (`?redirect=`).
  - Logged in: only *Your school*. The page says "You'll be the admin of this school.
    Your other schools stay available from the user menu."
  - Slug: filled in from the school name (lowercase, dashes, Arabic names
    transliterated or left for the user to type) until the user edits it. The
    availability check runs as they type (debounced), with the reason shown inline.
  - A hidden honeypot field `website`.
  - On success: `router.replace('/dashboard')`. The auth context picks up the new user
    (admin of the new school) from the response.
- **Not guest-only in `proxy.ts`.** Both guests and logged-in users can open it.
- **Entry links:** a "Create your school" call-to-action on the home page and the
  login chooser, a link on `/register`, and "Create a new school" in the user menu
  (under "Switch to").
- **Plain accounts:** a logged-in user with no memberships (from `/register`) gets
  sent to `/create-school` instead of an empty dashboard that only shows 403s.
- English and Arabic strings in `frontend/messages`.

## Phase 3 — Abuse protection + email verification

**Throttling and bots**

- Named limiter `school-signup`: **3 per hour per IP** and **10 per day per IP**
  (`RateLimiter::for` in `AppServiceProvider`). *Shipped with phase 1.* Only
  successful creations (`201`) count, so a form resubmitted after a validation error
  doesn't use one up. The general `api` limit still caps raw requests.
- Honeypot: a filled `website` field → `422` with a generic message, nothing created,
  and the attempt logged.
- **Cap per account:** a user can create at most `schools.max_self_service_per_user`
  schools (config, default 3), counted by `created_by_id`. The system admin isn't
  capped by this.
- Captcha (e.g. Cloudflare Turnstile) is **not** in this phase. Add it only if spam shows
  up. The form keeps room for it.

**Email verification (gates outgoing mail, not the school)**

- `User` implements `MustVerifyEmail`. A verification email goes out on school signup
  and on `/register`. Needs mail configured (`MAIL_*`; see "Infrastructure").
- Verify link → `GET /api/email/verify/{id}/{hash}` (signed URL) → redirects to the
  frontend. `POST /api/email/verification-notification` resends it (throttled).
- **What waits for verification:** only actions where the school sends email to other
  people:
  - password-reset or invitation emails sent to a school's users by its admin (teacher
    logins, parent accounts, `SchoolProvisioner`-style invitations);
  - later, announcement or notification emails from the school.

  These answer `403` with "Verify your email to send emails from your school". The
  records are still created (for example, a teacher gets a membership) and the email
  can be sent after verification.
- Everything else works right away: structure, students, fees, exams…
- Frontend: a banner for unverified school owners, "Check your inbox to verify
  *email* · Resend".
- Accounts that existed before this change are treated as verified (a migration sets
  `email_verified_at = created_at` where it's null), so existing schools keep working.

## Phase 4 — Setup checklist

A new school has nothing in it, and most pages depend on structure existing first
(students need classrooms, classrooms need grades, and so on).

- `GET /api/onboarding` (admin, current school) →
  `{ steps: [{ key, done, count }], dismissed: bool }`. Steps are computed live from
  counts, so no progress is stored:
  1. branding (school name + logo or primary colour set),
  2. academic year (a current one exists),
  3. stages, 4. grades, 5. classrooms, 6. subjects,
  7. teachers (at least one), 8. students (at least one).
- A **checklist card** at the top of the admin dashboard, with each step linking to its page
  (in dependency order). It's hidden once every step is done, or after "Dismiss", which
  is stored as a setting `onboarding_dismissed_at` (a new row in
  `SchoolProvisioner::DEFAULT_SETTINGS`, group General).
- **Quick start (optional, recommended):** on the checklist, "Create a standard
  structure" makes a current academic year, stages, grades and one classroom per grade,
  using the same shape as the base seeders (move that logic into a service,
  `SchoolStructureTemplate`, used by both the seeder and this button). This action is
  only offered while the school has no stages.
- Everything goes through the existing services and the current school context, so
  nothing new bypasses `BelongsToSchool`.

## Phase 5 — Central dashboard hooks

Once the matching phases of [central-dashboard-plan.md](./central-dashboard-plan.md)
exist:

- **Audit log (dashboard phase 2):** record `school.self_registered` (actor = owner,
  details: source IP, slug).
- **Overview (dashboard phase 4):** a "New schools (7 days)" card, a `source` filter and
  column in the schools table, the owner's email on the school detail page, and a
  warning badge on **self-service schools whose owner never verified their email
  after 7 days**.
- **Plans (dashboard phase 9):** self-service schools start on the plan in config
  `schools.self_service_default_plan` (recommended: *Basic*). Schools created by a
  system admin keep *Unlimited*. Until phase 9 exists, there are no limits.
- **Lifecycle (dashboard phase 7):** a system admin can suspend or archive spam
  schools as usual. Option: an "Archive all unverified self-service schools older than
  30 days" action, or a scheduled command.

## What stays unchanged

- Tenancy: each school is its own tenant. The new school gets the same default
  settings, per-school roles and membership as one made by a system admin.
- Logins: the owner logs in later as **Admin** on the admin login form, and gets the
  school picker if they're admin of more than one school.
- The system admin flag: self-service never grants `is_platform_admin`.

## Security checklist

- Signup is throttled per IP. There's a honeypot and a cap on schools per account. Slugs
  are validated and reserved words blocked.
- The new token is bound to the new membership only. It gives no access to other
  schools and never gets the `platform` ability.
- Account and school are created in one transaction, so a failure never leaves an
  account without its school (or the reverse).
- Emails to third parties wait for the owner's email verification.
- Nothing new reads across schools. The slug check only reveals whether a slug is
  taken, which is public anyway (it's the school's address).

## Infrastructure needed

- **Mail** (`MAIL_*` in `.env`) for verification emails. Without it, phase 3's gate
  would block all outgoing school email. In local/testing, use the `log` mailer.
- Nothing else: no queue or scheduler is needed (the optional cleanup in phase 5 would
  use the scheduler from the dashboard plan).

## Testing

Feature tests in the style of `SchoolLoginTest` / `PlatformSchoolTest`:

- Guest signup creates user + school + admin membership + default settings. The
  returned token reads that school's data and gets 403 on another school's.
- A logged-in user with a school at A creates school B: gets an admin token for B, the
  old token is revoked, and A is still in `memberships`.
- Taken, reserved and invalid slugs are refused, and the slug endpoint gives the
  matching reason.
- The 4th school from the same account is refused, and the throttle trips after 3 per
  hour.
- A filled honeypot creates nothing.
- If the provisioner fails mid-way (for example, a forced exception), no user is left
  behind.
- An unverified owner can create students and teachers, but sending an invitation or
  reset email to them answers 403. After verification it works.
- The onboarding steps flip to `done` as the matching records appear. Quick start
  creates the structure only when the school has no stages.
- The platform `POST /api/platform/schools` still works and records `source = platform`.

## Open questions

- **Terms of service:** require an "I accept the terms" checkbox at signup (and store
  `terms_accepted_at`)? Needs a terms page first.
- **`/register`:** keep plain accounts at all, or make `/register` the same page as
  `/create-school`? (A plain account can't do anything until someone adds it to a
  school.)
- **School defaults:** should signup also ask for country, language (en/ar), currency
  and school week? These overlap with the demo seeder's open questions (school week,
  currency) and would become per-school settings.
- **Caps:** are 3 schools per account and 3 signups per IP per hour the right numbers?
- **Owner vs admin:** should the creator be a special "owner" (for example, the only one
  who can remove other admins), or just the first admin like today? This plan
  assumes "just the first admin".
