# Central Dashboard Plan (system admin)

Status: **phases 1–5 done** (2026-09-29); phases 6–9 planned (written 2026-09-28).
See "As built" at the end. Builds on
[multi-tenancy.md](./multi-tenancy.md) (steps 1–8 are done).

## Goal

- Every school has **admins, teachers, parents and students**, each able to log in and
  see only their school. *(Already true — see "What exists today".)*
- A **system admin** has access to **all** schools and a **central dashboard** to
  **monitor** them (people, finance, activity, usage) and **control** them (lifecycle,
  admins, announcements, plans and limits).

Decisions made (2026-09-28):

| Question | Decision |
|---|---|
| How does the system admin reach a school's data? | **Enter the school as its admin**, with a banner and every action written to an audit log |
| What to monitor | People counts, finance, activity & health, usage & limits |
| What to control | School lifecycle, school admins, announcements, plans & limits |
| Two-factor login | **Required** for system admins (authenticator app, TOTP) |

## What exists today

| Piece | State |
|---|---|
| School logins (admin / teacher / parent / student) | Done. Per-role login forms; a login is "this role at this school" (a membership). Roles are per school (spatie teams). One person can hold roles at several schools and switch. |
| System admin flag | `users.is_platform_admin`, granted only with `php artisan platform:admin {email}` |
| Platform page | `/platform/schools`: list, create (invites the first admin), suspend/reactivate |
| System admin login | **Missing.** A system admin can only log in through a school membership |
| Seeing inside a school | **Missing.** Only possible if the system admin is also a member there |
| Monitoring, audit log, announcements, plans, 2FA | **Missing** |
| Last login / activity tracking | **Missing.** Nothing records when anyone was last active |

## Recommendations built into this plan

1. **The system admin gets their own login**, not tied to a school: a "System admin"
   option on the login chooser. The account needs no school membership.
2. **Keep the flag CLI-only.** The web UI can never make someone a system admin.
3. **Audit everything the system admin does**, and show school admins what the system
   admin did in *their* school (transparency builds trust with schools).
4. **2FA required** for system admins, plus a **re-confirmation step** (a fresh 2FA code)
   before the most dangerous actions: entering a school, deleting a school.
5. **Soft delete first:** deleting a school archives it (read-only, invisible to its
   users) and only a later, explicit purge removes the data, after an export.
6. **Every active school must keep at least one admin**; the dashboard flags any that
   doesn't.

## Phases

Each phase is shippable on its own. Rough sizes: S ≈ half a day, M ≈ 1–2 days,
L ≈ 3–5 days.

| # | Phase | Size | Depends on |
|---|---|---|---|
| 1 | System admin login + 2FA | M | — |
| 2 | Audit log | S | — |
| 3 | Activity tracking (last login / last seen) | S | — |
| 4 | Dashboard: overview + school detail (monitoring) | L | 3 |
| 5 | Enter school as admin | M | 1, 2 |
| 6 | School admins management | M | 2 |
| 7 | School lifecycle: edit, archive, export, purge | L | 2 |
| 8 | Announcements | S | — |
| 9 | Plans & limits | M | 4 |

---

## Phase 1 — System admin login + required 2FA

**Login**

- Add `system` to the login roles (`LoginRequest` role rule; a new
  `/login/system` page on the frontend chooser).
- `AuthService::login()` for role `system`: password must match **and**
  `is_platform_admin` must be true (same generic "credentials don't match" message
  otherwise). No membership is looked up.
- The token is a **platform token**: `personal_access_tokens.school_membership_id` null
  and a Sanctum ability `platform`. School tokens don't get that ability.
- `ResolveSchool`: a platform token sets **no** school (school data answers 403) unless
  a school is entered (phase 5).
- Platform routes (`/api/platform/*`) require the `platform` ability **and**
  `is_platform_admin` (`EnsurePlatformAdmin` checks both). A system admin who also
  happens to be a school admin can't reach platform routes with their school token.
- After login the frontend sends system admins to `/platform` (not `/dashboard`).

**Two-factor (TOTP)**

- Package: `pragmarx/google2fa` (codes) + `bacon/bacon-qr-code` (QR image). Fortify
  isn't needed; this app's auth is token-based through the BFF.
- Columns on `users`: `two_factor_secret` (encrypted cast), `two_factor_recovery_codes`
  (encrypted JSON, 8 codes), `two_factor_confirmed_at`.
- Login becomes two steps for system admins:
  1. `POST /api/login` (role `system`) with a correct password → **no token yet**;
     response `{ two_factor: "setup" | "challenge", challenge_id }`. `challenge_id` is a
     short-lived (5 min), single-use cache entry tied to the user.
  2. `POST /api/login/two-factor` with `challenge_id` + `code` (or a recovery code) →
     the platform token. The BFF treats this route like login (stores the cookie).
- First login without 2FA set up: step 1 answers `setup` with the QR code / secret;
  step 2 confirms the first code and saves it. There's no way around setup.
- **Re-confirmation ("sudo mode"):** entering a school and deleting a school require a
  2FA code entered within the last 10 minutes (`POST /api/platform/confirm` →
  timestamp on the token row).
- Recovery: `php artisan platform:reset-2fa {email}` (CLI only) clears 2FA so it's set
  up again at next login.
- Throttle: `throttle:5,1` on both login steps.

## Phase 2 — Audit log

- Table `audit_logs`: `id`, `actor_id` (user), `school_id` (nullable), `action`
  (e.g. `school.suspended`, `student.updated`, `platform.entered_school`),
  `subject_type` + `subject_id` (nullable), `details` (JSON — changed fields,
  before/after for updates), `ip`, `user_agent`, `created_at`. Append-only: no update
  or delete route, no `updated_at`.
- Not `BelongsToSchool` (platform-wide); read through explicit queries only.
- `AuditLog::record($action, $subject = null, $details = [])` helper fills actor, school
  (from `TenantContext`), ip, user agent.
- **What is recorded:**
  - every platform action (create/edit/suspend/archive/export/purge school, admin
    changes, announcements, plan changes, 2FA reset);
  - **every request made while a system admin is inside a school** (phase 5), via a
    middleware: method, route name, status, and for writes the changed fields;
  - reads of especially sensitive records while inside a school: student profile,
    attachments.
- Views: platform-wide audit page (filter by school, actor, action, date), and a
  per-school "Activity by system admin" tab that **that school's admins can also see**.
- Retention: keep 2 years; `php artisan audit:prune` for older rows (scheduled when a
  scheduler exists — see "Infrastructure").

## Phase 3 — Activity tracking

- `users.last_login_at` (set on successful login) and
  `school_memberships.last_seen_at` (set by `ResolveSchool` for the resolved membership,
  **at most once every 5 minutes** per membership to avoid a write per request —
  compare in memory, update with a single query).
- Enough to answer "active users this week per school", "last activity at this school",
  "schools inactive for 30 days", "teachers who never logged in".

## Phase 4 — Dashboard (monitoring)

**Pages** (frontend, under `/platform`, own layout and sidebar, English/Arabic):

1. **Overview** — cards: schools (active / suspended / archived), total students,
   teachers, parents; fees collected this month across all schools; active users this
   week. Then the **schools table**: name, status, plan, students, teachers, parents,
   outstanding fees, active users (7 days), last activity, storage, and warning badges.
   Sortable, searchable, filter by status/plan.
2. **School detail** (`/platform/schools/{id}`) — tabs:
   - *Overview*: key numbers, plan and usage vs limits, warnings, "Open school" (phase 5).
   - *People*: counts by role, admins list (phase 6), new students per month.
   - *Finance*: charged / collected / outstanding for the current academic year,
     collections per month, share of charges unpaid / partial / paid / waived.
   - *Activity*: active users per week (by role), attendance recording rate (school days
     with attendance recorded ÷ school days in the last 30), last logins.
   - *Usage*: storage by collection (attachments, library, settings), student count vs
     plan limit.
   - *Audit*: this school's audit entries.
3. **Audit log** (phase 2), **Announcements** (phase 8), **Plans** (phase 9),
   **My account** (2FA, recovery codes).

**Warning badges** (drive attention): no active admin; no activity for 30 days;
attendance not recorded for 5+ school days; over 90% of a plan limit; outstanding fees
above a threshold; suspended.

**API**: `GET /api/platform/overview`, `GET /api/platform/schools` (extended with
metrics), `GET /api/platform/schools/{school}` + `/finance`, `/activity`, `/usage`.

**How metrics are computed**

- Cross-school aggregate queries grouped by `school_id`, using `withoutSchoolScope()`
  in **one** class (`App\Platform\SchoolMetrics`) — the second sanctioned cross-school
  read path after `ParentChildren`. Example: `Student::withoutSchoolScope()
  ->selectRaw('school_id, count(*)')->groupBy('school_id')`.
- People: `school_memberships` (active) by role. Finance: `fee_charges.amount_due` and
  `fee_payments.amount` sums. Storage: `sum(media.size)` by `school_id`.
- Cached per metric for 10 minutes (`platform:metrics:*` keys — platform-level, not
  school data). A "Refresh" button bypasses the cache.
- **Growth over time** needs history: a daily snapshot table `school_daily_stats`
  (`school_id`, `date`, students, teachers, parents, active_users, collected,
  outstanding, storage_bytes) filled by `php artisan platform:snapshot` once a day.
  Charts read snapshots; today's numbers come live.

## Phase 5 — Enter a school as admin

- "Open school" on the school detail page → re-confirm 2FA (sudo mode) → optional
  reason text → `POST /api/platform/schools/{school}/enter`.
- The server records a **platform session**: table `platform_sessions` (`id`,
  `user_id`, `school_id`, `reason`, `started_at`, `ended_at`), audits
  `platform.entered_school`, and issues a **second token** bound to that session
  (`personal_access_tokens.platform_session_id`). The platform token stays valid; the
  BFF keeps both (school token as the active one, platform token to come back).
- `ResolveSchool`: a token with a `platform_session_id` → that session's school, as
  long as the session is open, the user is still a system admin and the school isn't
  archived. **Suspended schools can be entered** (so problems can be fixed).
- Permissions inside: act as a full admin of that school. `Gate::before` already
  allows admins; extend it to "or a platform session for the current school". The user
  payload reports `roles: ['admin']`, all admin permissions, and
  `acting_as: { type: 'system_admin', school }` so the frontend shows every admin page.
- **Banner** on every page while inside: "Viewing *Green Valley* as system admin —
  actions are logged · Exit". Exit → `POST /api/platform/exit` ends the session,
  revokes the school token, returns to `/platform`.
- Sessions expire after 2 hours of use; the audit middleware (phase 2) records every
  request during the session.
- The school's admins see these sessions and their actions in their audit tab.

## Phase 6 — School admins management

On the school detail page, *People* tab:

- List the school's admins (name, email, last login, status, 2FA not applicable).
- **Add admin**: existing account → admin membership; new email → account + invitation
  (same path as creating a school: `SchoolProvisioner`-style, via
  `MembershipService::grant()`).
- **Remove admin**: `MembershipService::revoke()`; refused if it's the school's last
  active admin.
- **Resend invitation** / **send password reset** for any user of the school
  (sends the reset email; the system admin never sees or sets passwords).
- **Suspend a member** (membership status `suspended` → their token is signed out on
  the next request, as today).
- All of these audited.

## Phase 7 — School lifecycle

- **Edit**: name, slug (warn: changes links), branding (logo, primary colour — the
  school's settings rows), contact details.
- **Suspend / reactivate**: exists; add a required reason (audited, shown to the school
  admins on the login page: "This school is suspended. Contact …").
- **Archive (soft delete)**: status `archived` — like suspended, but hidden from lists
  by default and its users see "no longer available". Reversible for 30 days.
- **Export**: `POST /api/platform/schools/{school}/export` → queued job builds a zip:
  one JSON file per school-owned table (rows with that `school_id`), the school's
  memberships, and all its files (`schools/{id}/` on the public and private disks).
  Download link valid 24 hours, audited. Also useful when a school leaves.
- **Purge** (after archive + export): CLI only,
  `php artisan school:purge {id} --confirm=<slug>`. Deletes in dependency order
  (children before parents — the composite foreign keys enforce it), then files, then
  memberships, then the school. Users whose only membership was this school are
  deleted; users with other schools keep their accounts. Audited.
- Status enum becomes `active | suspended | archived`.

## Phase 8 — Announcements

- Table `announcements`: `title` / `body` (translatable en/ar), `level`
  (info / warning / critical), `school_id` (null = all schools), `audience` (all roles,
  or a subset: admins / teachers / parents / students), `starts_at`, `ends_at`,
  `created_by`. Platform-level (not `BelongsToSchool`).
- System admin creates / edits / ends them from `/platform/announcements`.
- `GET /api/announcements` returns the ones active now for the current school and role;
  the frontend shows them as a dismissible banner (dismissal remembered per user in
  `announcement_dismissals`; critical ones can't be dismissed).

## Phase 9 — Plans & limits

- Table `plans`: `name`, `max_students`, `max_storage_mb`, `features` (JSON list:
  `exams`, `meetings`, `library`, `fees`, …). Seed "Basic", "Standard", "Unlimited".
  `schools.plan_id` (default: Unlimited, so existing schools don't change).
- **Enforcement** (server side; the frontend just hides things):
  - student registration refused over `max_students` (clear message to the school
    admin: "Your plan allows 200 students");
  - uploads refused over `max_storage_mb`;
  - a `feature:{name}` route middleware on each module's routes → 403 with
    "Not included in your plan"; the user payload lists the school's features so the
    frontend hides those nav items.
- Dashboard shows usage vs limits and warns at 90%.
- Billing (prices, invoices, payment) is **out of scope**; plans are the groundwork.

---

## Security checklist

- Platform routes: `auth:sanctum` + `platform` token ability + `is_platform_admin`.
- The flag is CLI-only; 2FA required; sudo mode for enter/delete; login throttled.
- A school token can never reach platform routes, and a platform token can never read
  school data without an open platform session.
- Every system-admin action and every request inside a school is audited; school admins
  can see what was done in their school.
- Metrics are aggregates; the dashboard never lists individual students outside an
  entered school.

## Infrastructure needed

- **Scheduler** (`php artisan schedule:run` every minute via cron / Task Scheduler) for
  `platform:snapshot` (daily), `audit:prune` (monthly), expiring platform sessions.
  Not configured today (see [gaps.md](./gaps.md)).
- **Queue worker** for exports (`queue:work`); jobs already carry the school
  (multi-tenancy step 7). Not configured today either.
- **Mail** configured for invitations and password resets (`MAIL_*` in `.env`).

## Testing

- Feature tests per phase, in the style of the multi-tenancy tests (`SchoolLoginTest`,
  `PlatformSchoolTest`): system admin login with and without 2FA; school tokens
  refused on platform routes; platform token without a session gets 403 on school
  data; entering a school gives admin access to that school only and is audited; exit
  revokes; last-admin protection; plan limits refuse registration; metrics match
  hand-counted fixtures across two schools.
- The demo data from [demo-seeder-plan.md](./demo-seeder-plan.md) (two schools, fees,
  attendance) makes the dashboard meaningful to click through.

## Open questions

- **Transparency:** should school admins see the system admin's activity in their
  school (recommended: yes), and should they be notified by email when a system admin
  enters?
- **Archive → purge window:** 30 days OK?
- **Plan limits:** real numbers for Basic / Standard (students, storage), and which
  features each includes.
- **More than one system admin?** The plan supports several (all equal). Is a
  read-only "support" system admin role needed?
- **Hosting:** can the server run a scheduler and a queue worker (cron / supervisor)?

## As built (phases 1–4, 2026-09-29)

- **Login:** `/login/system`, also linked from the login chooser. `role: system`
  on `POST /api/login` → `{ two_factor: setup|challenge, challenge_id, … }` →
  `POST /api/login/two-factor` → a token with the `platform` ability. A signed-out
  visit to `/platform` goes there.
  - Codes are single-use.
  - The code step has its own named limiter (`two-factor`, 5 a minute). Unnamed
    `throttle:N,M` limits share one counter per IP, so mistyped passwords would
    have used up the code attempts.
- **Platform routes need the platform token:** `EnsurePlatformAdmin` checks the
  token's own ability list, not `tokenCan()`, which a `*` school token would pass.
  The same account signed in as a school's admin gets 403. The old "can't suspend
  the school you're signed in to" guard is gone, since a platform token has no
  school.
- **Audit log:** `audit_logs` and `AuditLog::record()`. Recorded so far:
  - system admin sign-in;
  - school created, edited, suspended, reactivated;
  - 2FA reset (CLI).

  `GET /api/platform/audit-logs` with filters, the `/platform/audit` page, and
  `audit:prune`. The middleware that records every request inside an entered school
  comes with phase 5.
- **Activity:** `users.last_login_at` (set by school login, system login and
  self-service signup) and `school_memberships.last_seen_at` (set by
  `ResolveSchool`, at most every 5 minutes).
- **Monitoring:** everything is computed in `AppPlatformSchoolMetrics`
  (query-builder aggregates grouped by `school_id`, cached 10 minutes, and
  `?refresh=1` skips the cache).
  - **Overview** (`/platform`): totals, and "collected this month" per currency,
    never added across currencies. A schools table you can search, filter by status
    and sort, with warnings: suspended, no admin, inactive for 30 days, no
    attendance on the last 5 school days.
  - **School detail** (`/platform/schools/{id}`): tabs for overview, people,
    finance (6-month collections chart plus a table view), activity, usage and
    audit.
- **Deferred:** the `school_daily_stats` snapshots and growth charts need a
  scheduler, which isn't configured yet ([gaps.md](./gaps.md)). Charts read live
  data for now.

## As built (phase 5, 2026-09-29)

- **Opening a school:** "Open school" on the school detail page →
  `POST /api/platform/confirm` (a fresh code, good for 10 minutes; stored on the
  platform token as `platform_confirmed_at`) → `POST /api/platform/schools/{id}/enter`
  with an optional reason. This creates a `platform_sessions` row, lasting 2 hours
  (`expires_at`), and a token with `platform_session_id`.
- **Acting as admin:** `ResolveSchool` sets that session's school and puts the admin
  role on the user **in memory only**. No membership or role assignment is written,
  so `Gate::before` and the `role`/`permission` middleware treat them as admin
  for that request. The user payload carries `acting_as` (school and expiry), and
  `current_membership` stays null. Suspended schools can be entered.
- **Proxy:** while inside a school, the active cookie holds the session token and
  `sanctum_platform_token` keeps the platform token.
  - `POST /api/platform/exit` ends the session and swaps back.
  - A 401 while a platform token is waiting (session expired, or access lost) swaps
    back too, and a GET is retried with the platform token, so the page gets the
    platform user instead of a sign-out.
  - Logout revokes both tokens.
- **Audit:** the `AuditPlatformSession` middleware records every request made
  inside a school (method, path, route, status, and for writes the names of the
  fields sent, never their values or passwords). Entering and leaving are recorded
  too. The enter request itself isn't logged as an "inside" request.
  `AuditLog::record(..., platformWide: true)` keeps platform-wide entries (system
  admin sign-in, 2FA reset) from being tagged with the default school, which public
  routes fall back to.
- **School admins:** see all of it at `/admin/system-admin-activity` ("System admin
  activity" in their sidebar): sessions with the reason and times, and every entry.
- **Frontend:** a banner on every page while inside (school, end time, Exit). The
  user menu hides "Switch to" and "Create a new school" there, since either would
  replace the session token.
