# Multi-Tenancy Migration Plan (shared DB + `school_id`)

Status: proposal, not implemented. Current app is single-tenant — no `school_id`
column anywhere, one DB (SQLite by default in `.env`; MySQL/MariaDB via XAMPP locally).

This plan keeps **one database** and tags every school-owned row with `school_id`.
People (users) are global; a school is a set of **memberships** linking users to it.

It replaces an earlier draft that proposed DB-per-school with `stancl/tenancy`. That
option is still reachable later for a single school that needs physical isolation
(see [Escape hatch](#escape-hatch-splitting-one-school-out)), but it is not the
starting point.

## Why shared DB over DB-per-school

- **People cross schools.** A parent with children at two schools, a teacher who
  works at two schools, a student who transfers. With DB-per-school, `users` lives in
  each school's DB, so each of those is two accounts with two passwords. With global
  users + memberships it is one login and a school switcher.
- **Ops stay simple.** One `php artisan migrate`, one backup, one connection pool.
  No per-school DB provisioning, no fan-out migrations, no connection switching in
  queue workers.
- **Cross-school reporting** (platform admin, future school groups) is a normal query
  instead of a fan-out across N databases.
- **Tooling already exists.** `spatie/laravel-permission` has a built-in `teams`
  mode (`config/permission.php`, currently `'teams' => false`) that scopes role
  assignments per team — the team is the school.

Cost: isolation is logical, not physical. A missed scope leaks data silently. Most of
this plan is about making that failure mode loud or impossible (see
[Enforcement](#enforcement-layers)).

## Data model

### New tables

```
schools              id, name, slug (unique), status (active|suspended), settings..., timestamps
school_memberships   id, user_id, school_id, role (admin|teacher|parent|student),
                     status (invited|active|suspended|left), started_at, ended_at, timestamps
                     unique(user_id, school_id, role)
```

- A user can have many memberships (parent at School A, teacher at School B).
- Leaving/transferring sets `status = left` + `ended_at`; the row is never deleted,
  so history (old grades, fee payments) still points at a real membership.

### Stays global (no `school_id`)

- `users`, `personal_access_tokens`, `password_reset_tokens`, `sessions`
- `permissions`, `roles` (role *definitions* are global; *assignments* are per-school
  via spatie teams)
- Lookup tables: `nationalities`, `religions`, `blood_types`, `governorates`
- Laravel infra: `cache`, `jobs`, `failed_jobs`, `job_batches`

### Gets `school_id`

Everything else: `stages`, `grades`, `classrooms`, `subjects`, `subject_stage`,
`subject_grade`, `teachers`, `subject_teacher`, `classroom_subject_teacher`,
`academic_years`, `students`, `fathers`, `mothers`, `promotions`, `graduations`,
`fees`, `fee_charges`, `fee_payments`, `attendances`, `exams`, `exam_questions`,
`exam_question_options`, `exam_attempts`, `exam_attempt_answers`, `meetings`,
`meeting_classroom`, `zoom_connections`, `library_resources`,
`library_resource_subject`, `settings`, `calendar_events`, `posts`, `media`.

Child tables (`exam_attempt_answers`, `fee_payments`, …) get `school_id` too, even
though it is derivable through the parent. That redundancy is what makes the
composite foreign keys below possible.

### Unique constraints that must become per-school

These are globally unique today and would block a second school:

| Table | Today | Becomes |
|---|---|---|
| `academic_years` | `unique(year)` | `unique(school_id, year)` |
| `settings` | `unique(key)` | `unique(school_id, key)` |
| `teachers` | `unique(email)` | `unique(school_id, email)` |
| `roles` (spatie) | `unique(name, guard_name)` | handled by teams mode (`team_foreign_key`) |

`users.email` stays globally unique — that is the point of global identity.

Existing composite uniques (`attendances(student_id, date)`,
`fee_charges(student_id, fee_id)`, …) are already implicitly per-school because the
referenced rows are per-school; leave them.

## Enforcement layers

MySQL/MariaDB has no row-level security, so there is no single DB-engine backstop
like Postgres RLS. Instead, four layers, each catching what the one before misses.

### 1. Composite foreign keys — cross-school references are unrepresentable

Every tenant table gets `unique(school_id, id)`. Every FK between tenant tables
includes `school_id`:

```php
$table->foreignId('school_id')->constrained();
$table->unsignedBigInteger('classroom_id');
$table->foreign(['school_id', 'classroom_id'])
      ->references(['school_id', 'id'])->on('classrooms');
```

Now a student row in School A *cannot* point at a classroom in School B — the DB
rejects the insert. This covers bugs in create/update paths, seeders, imports and
tinker, which no app-level scope can.

(InnoDB requires the referenced columns to be indexed — the `unique(school_id, id)`
on the parent satisfies that. SQLite also supports composite FKs, so tests can run on
either.)

### 2. `BelongsToSchool` trait — reads are scoped automatically

One trait on every tenant model:

- **Global scope** adding `where school_id = <current school>`. This also makes
  route-model binding return 404 for another school's record (`/students/{id}`).
- **`creating` hook** that fills `school_id` from the current school, so controllers
  never set it by hand.
- **Fail loud, not open:** if a tenant model is queried with no current school set
  (e.g. a job that forgot to restore context), throw `MissingSchoolContext` — never
  silently return all schools' rows.

The current school comes from a request-scoped `TenantContext` singleton, **not** from
`Auth::user()` directly, so the same trait works in queue workers and artisan
commands.

What ships with it (all in `backend/app/Tenancy/`):

- **`ResolveSchool` middleware**, prepended to the `api` group so it runs before
  route-model binding. Still hard-wired to the oldest school until step 5.
- **Pivot tables:** models declare pivot relations with `belongsToManyInSchool()`
  instead of `belongsToMany()`, so `attach()`/`sync()` write `school_id` into the
  pivot row and reads only match the current school's pivot rows.
- **Validation:** `SchoolScopedPresenceVerifier` replaces Laravel's presence verifier,
  so every `exists:`/`unique:` rule on a school-owned table checks only the current
  school — another school's `grade_id` fails with 422 instead of passing.
- **Media:** `App\Models\Media` (set as media-library's `media_model`) copies
  `school_id` from the owning model on create.
- **Seeding and console:** `DatabaseSeeder` sets the context to the default school
  and no longer uses `WithoutModelEvents`, which would skip the `creating` hook.
  Running a single seeder, or any command that touches school-owned data, must set
  the context first, e.g. `app(TenantContext::class)->runAs($school, fn () => ...)`.
- **Guard test:** `SchoolIsolationTest` fails if a model on a table with `school_id`
  doesn't use `BelongsToSchool`.

### 3. Tenant comes from the authenticated membership, never a header

- Login is global (email + password against `users`).
- After login the user has one or more active memberships. One → auto-select. More →
  school picker. The chosen `membership_id` is stored on the Sanctum token
  (`personal_access_tokens` gets a nullable `school_membership_id` column, or it goes
  in token abilities).
- `ResolveSchool` middleware runs right after `auth:sanctum`: loads the token's
  membership, checks it is `active` and belongs to the token's user, then sets
  `TenantContext` and spatie's team id (`setPermissionsTeamId($schoolId)`).
- Switching schools = issue a new token for another membership. No re-login.
- The BFF may still send a school slug (subdomain/path) for **pre-login branding
  only** (logo, name on the login page). After login, if the slug disagrees with the
  token's school → 403. The header never selects which data is read.

### 4. Tests and guard rails

- **One cross-school test per tenant model:** seed School A + School B, act as a
  School A user, assert School B's record is 404 on show/update/delete and absent
  from index.
- **Arch test** (Pest `arch()`): forbid `DB::table(` / raw queries on tenant tables
  outside an allow-listed set of files, since query-builder calls bypass Eloquent
  scopes.
- **`withoutSchoolScope()`** is the only sanctioned bypass, gated behind a
  `platform-admin` permission and logged (actor, reason, time).

## Things outside the DB that also need scoping

- **Queued jobs:** capture `school_id` in the job constructor; a job middleware
  restores `TenantContext` before `handle()` and clears it after. Layer 2 throws if a
  job forgets.
- **Cache keys:** prefix with school id for anything school-owned. The existing Zoom
  OAuth state (`zoom_oauth_state:{$state}` in `app/Services/ZoomService.php`) is keyed
  by a random state token, so it is safe, but it should also store `school_id` so the
  callback restores the right school.
- **Media:** `media` gets `school_id`; use a custom `PathGenerator` so files live under
  `schools/{school_id}/...` instead of `{media_id}/...`. Media owned by a global
  `User` (avatars) keeps `school_id` null, so on `media` the column stays nullable
  permanently.
- **Settings:** become per-school (`unique(school_id, key)`); the public
  `SettingController` endpoint reads the pre-login slug to pick the school.

## Roles and permissions (spatie teams)

- Set `'teams' => true` and `'team_foreign_key' => 'school_id'` in
  `config/permission.php`, then publish/add the team column to `model_has_roles` and
  `model_has_permissions`.
- Role definitions (`admin`, `teacher`, `parent`, `student`) stay global.
  Assignments carry `school_id`, so a user can be `teacher` at A and `parent` at B.
- `ResolveSchool` calls `setPermissionsTeamId()` before any `permission:` route
  middleware runs, so existing `Route::middleware('permission:manage-fees')` groups in
  `routes/api.php` keep working unchanged.
- `school_memberships.role` and the spatie assignment must stay in sync — write both
  through one `MembershipService`, never separately.

## Existing links to `users` that change meaning

- `students.user_id` / `students.parent_user_id` and `teachers.user_id` stay as they
  are — they point at global users. Because the student/teacher row itself has
  `school_id`, a parent user with children at two schools naturally sees only the
  active school's children through the global scope.
- Parent/student portals (`ParentPortal\*`, `StudentPortal\*` controllers) need no
  query changes; the scope does the filtering.

## Migration steps (incremental, each shippable)

1. **`schools` + `school_memberships` tables.** Seed one school; create a membership
   for every existing user from their current spatie role. No behavior change.
2. **Add nullable `school_id`** to all tenant tables; backfill with the seeded
   school's id.
3. **`TenantContext` + `ResolveSchool` middleware + `BelongsToSchool` trait**, with
   the context hard-wired to the one school. Add the cross-school tests with a second
   seeded school — they should pass.
4. **Make `school_id` NOT NULL**, add `unique(school_id, id)` and switch FKs to
   composite, one module at a time (academics → students → fees → exams → …).
   Replace the global uniques in the table above.
5. **Global login + school picker.** Token carries the membership; frontend adds the
   picker and a school switcher in the user menu.
6. **Spatie teams on.** Migrate existing role assignments to carry `school_id`.
7. **Jobs, cache, media path generator.**
8. **Platform admin surface:** create/suspend schools, invite a school's first admin.
   Suspending a school = `schools.status = suspended`, checked in `ResolveSchool`.

Steps 1–3 can merge without any visible change to users.

## Escape hatch: splitting one school out

If one school later needs physical isolation (contract, compliance, size), export its
rows by `school_id` into a dedicated DB and point that school's connection there. The
app code does not change, because the boundary was always `school_id`.

## Open questions

- **Is the tenant a school or a school group?** Many private schools belong to a group
  with several campuses. If groups matter (shared admins, one fee statement per family,
  cross-campus reports), add `school_groups` above `schools` now; retrofitting it
  after `school_id` is in 33 tables is expensive.
- **Local DB:** `.env` defaults to SQLite, but XAMPP means MySQL/MariaDB. Switching
  local dev to MySQL is recommended before step 4, so composite FKs and index
  behavior match production.
- **Parent view across schools:** should a parent see all their children at once, or
  only the active school's? This plan assumes active-school only (simpler, safer); an
  all-schools summary would be an explicit, cross-school read path.
