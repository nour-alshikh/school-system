# Demo Seeder Plan

Status: **plan, not implemented** (written 2026-09-28).

## Why

`php artisan migrate:fresh --seed` today gives the school's structure and people, but
no activity. After a fresh seed:

| Seeded | Empty |
|---|---|
| 1 school, 3 stages, 12 grades, 36 classrooms, 10 subjects, 2 academic years | fees, fee charges, fee payments |
| 12 teachers (with logins), a teacher per subject in every classroom (216) | attendance |
| 24 students, each with a parent account | exams, questions, attempts |
| demo admin (also platform admin), a plain account | meetings, calendar events, posts, library resources |
| | promotions, graduations, media (photos) |
| | a second school, a parent with children at two schools |

So the dashboards show zeros, most list pages are empty, and none of the
multi-school work ([multi-tenancy.md](./multi-tenancy.md)) is visible. The goal: every
page has realistic content right after `migrate:fresh --seed`.

## Principles

- **Local/demo only.** `DatabaseSeeder` calls `DemoSeeder` only when
  `app()->environment('local', 'testing')` or `SEED_DEMO=true`. It never runs in
  production by accident.
- **Fresh databases only.** It assumes the base seeders just ran; it isn't meant to be
  re-run on top of existing data (unique keys would collide). No idempotency work.
- **Deterministic.** Use `fake()->seed(2026)` so every fresh seed produces the same
  names, amounts and dates. Demo scripts and screenshots stay valid.
- **Dates relative to today** (`now()->subDays(...)`), so "this month's attendance" and
  "upcoming events" are always current.
- **Through the app's own services where they exist:** `SchoolProvisioner` (second
  school), `MembershipService::grant()` (every role), so memberships, per-school roles
  and default settings are created exactly as in real use.
- **Every school-owned row is created inside that school's context:**
  `app(TenantContext::class)->runAs($school, fn () => ...)`. Without it
  `BelongsToSchool` throws `MissingSchoolContext`. The composite foreign keys also
  reject a row pointing at another school's grade/classroom/student.

## Structure

```
database/seeders/
  DatabaseSeeder.php          (existing) — calls DemoSeeder last, when allowed
  Demo/
    DemoSeeder.php            orchestrates the ones below, in this order
    SecondSchoolSeeder.php    Hilltop School: structure, admin, teachers, students
    CrossSchoolPeopleSeeder.php  shared parent, shared teacher
    FeeDemoSeeder.php         per school
    AttendanceDemoSeeder.php  per school
    ExamDemoSeeder.php        per school
    CalendarDemoSeeder.php    per school: events + meetings
    ContentDemoSeeder.php     per school: posts + library resources
    PhotoDemoSeeder.php       student photos (private disk)
    HistoryDemoSeeder.php     one promotion batch + one graduation
```

Per-school seeders take the school as an argument, so `DemoSeeder` runs them for both
schools: `foreach ($schools as $school) $context->runAs($school, fn () => (new FeeDemoSeeder)->run($school));`

## What each part creates

### 1. Second school — `SecondSchoolSeeder`

- `SchoolProvisioner::create('Hilltop School', 'hilltop', 'Hilltop Admin', 'admin@hilltop.demo')`.
  This creates the school, its default settings and its admin. Then set the admin's
  password to `password` (the provisioner sends an invite; in a seeder, set it
  directly and fake notifications with `Notification::fake()`).
- Smaller than the default school so the two are easy to tell apart:
  - 1 stage ("Primary"), 3 grades, 2 classrooms per grade, 1 academic year (current).
  - 4 subjects, 4 teachers (`*@hilltop.demo`), a teacher per subject per classroom.
  - 12 students with parents (`*@hilltop.demo`).
- Settings: `school_name` = Hilltop School, a different `primary_color`, so the branding
  visibly changes when switching schools.

### 2. People across schools — `CrossSchoolPeopleSeeder`

The accounts that show off memberships:

| Account | Setup | Shows |
|---|---|---|
| `family.parent@demo.school` | parent of one student at School System **and** one at Hilltop (register the second child with the same parent email — the existing link path) | parent overview with two cards, child picker, cross-school pages |
| `shared.teacher@demo.school` | teacher at both schools, assigned to a subject in one classroom each | school picker at login (same role at two schools), user-menu switcher |
| `test@example.com` (existing) | also admin of Hilltop (the provisioner call above can use this email instead, or grant separately) | admin switching schools, Platform → Schools with two schools |

### 3. Fees — `FeeDemoSeeder` (per school)

- 3 `Fee`s for the current academic year: "Tuition" (`is_for_all`, e.g. 1500.00),
  "Books" (per stage, 200.00), "Bus" (per grade, 300.00 — only some grades).
- A `FeeCharge` per student per applicable fee (`unique(student_id, fee_id)`), with
  `amount_due` = the fee amount.
- Payment mix, so every status appears:
  - ~50% `paid` (one or two `FeePayment`s summing to the amount),
  - ~25% `partial` (one payment, e.g. 40–70%),
  - ~20% `unpaid`,
  - ~5% `waived`.
- Payments: `paid_at` spread over the last 60 days, `method` mixed
  (cash / bank_transfer / card), `recorded_by_id` = the school's admin.
- Keep `FeeCharge.status` consistent with its payments. Use the same
  status calculation the app uses when recording a payment
  (`FeeChargeController`); don't hand-set a status that disagrees with the sums.

### 4. Attendance — `AttendanceDemoSeeder` (per school)

- The last 20 school days (skip Fridays/Saturdays, or whatever the school week is —
  check with the user), for every student in their classroom.
- `unique(student_id, date)`.
- Status mix: ~88% present, ~6% absent, ~4% late, ~2% excused. Give 2–3 students a
  noticeably worse record, so the reports have something to show.
- `recorded_by` = one of the classroom's teachers' user id.

### 5. Exams — `ExamDemoSeeder` (per school)

Per school, 3 exams:

| Exam | Type | Status | Window | Attempts |
|---|---|---|---|---|
| Math quiz (one grade) | quiz | published | closed last week | most students `submitted`, scored |
| Science exam (one grade) | exam | published | open now, closes in 3 days | a few `in_progress`, a few `submitted` |
| History exam (one grade) | exam | draft | next week | none |

- 5 multiple-choice questions each (`marks` 1–2), 4 options each, one `is_correct`.
- Submitted attempts: an `ExamAttemptAnswer` per question with `selected_option_id`,
  `is_correct` and `marks_awarded`. `ExamAttempt.score` = sum of `marks_awarded`.
  `unique(exam_id, student_id)` and `unique(attempt_id, question_id)`.
- `created_by` = the teacher of that subject in that classroom, so the teacher
  dashboards show them.

### 6. Calendar and meetings — `CalendarDemoSeeder` (per school)

- ~8 `CalendarEvent`s over the current and next month (parent meeting day, sports day,
  holiday, exam week, trip). `created_by` = admin.
- 3 `Meeting`s (next week, 45 min) attached to classrooms through `meeting_classroom`.
  **No Zoom:** leave `zoom_meeting_id` null and use a placeholder
  `join_url`/`start_url` (e.g. `https://example.com/demo-meeting`). Check how
  `MeetingController` / the student meetings page handle a meeting without a real
  Zoom id before choosing the placeholder.

### 7. Content — `ContentDemoSeeder` (per school)

- 6 `Post`s: mixed `category`, 4 `published` (`published_at` in the past), 2 `draft`,
  1 `is_featured`. `title`/`body` are translatable ({en, ar}); `user_id` = admin or a
  teacher.
- ~10 `LibraryResource`s across grades: mostly `type` = `link` (no file needed, e.g.
  Khan Academy / YouTube URLs), 2–3 `file` resources with a small generated PDF on the
  media collection `file`. Attach subjects via `library_resource_subject`
  (`belongsToManyInSchool`, so `school_id` is filled).

### 8. Photos — `PhotoDemoSeeder`

- 1 photo for about a third of the students: a generated solid-color PNG with their
  initials (GD), added with `addMedia(...)->toMediaCollection('attachments')`.
  Attachments are on the **private `local` disk** (see [media.md](./media.md)), so
  they only show through `/api/attachments/{id}`, which is exactly the path the demo
  should exercise.
- Avatars for a few users (the demo admin, a teacher, the family parent), on the
  public disk.

### 9. History — `HistoryDemoSeeder` (default school only)

- One promotion batch from the previous academic year, and one graduated student, via
  `PromotionService` / `GraduationService` (not raw inserts), so the history pages and
  rollback buttons have something to show.
- Do this carefully: promotions move students between years and classrooms. Either
  seed a small extra cohort just for history, or run it before the attendance/fee
  seeders so those use the students' final classrooms.

## Demo accounts (all passwords `password`)

To add to [demo-accounts.md](./demo-accounts.md) when implemented:

| Email | Role(s) | Use it to show |
|---|---|---|
| `test@example.com` | admin at both schools, platform admin | admin pages, school switcher, Platform → Schools |
| `admin@hilltop.demo` | admin at Hilltop only | a second school's admin sees only Hilltop |
| `shared.teacher@demo.school` | teacher at both schools | school picker at login, switcher |
| `family.parent@demo.school` | parent at both schools | children overview with two schools, child picker |
| `mona.ali@teachers.demo` (existing) | teacher | teacher dashboard with exams and attendance |
| `ali.hassan1.parent@demo.school` (existing) | parent | single-child parent, fees and attendance |
| `ali.hassan1.student@demo.school` (existing) | student | student dashboard, exams to take |
| `user@example.com` (existing) | none | plain account, 403 on school data |

## Done when

- `php artisan migrate:fresh --seed` finishes without errors on SQLite **and** MySQL
  (XAMPP), in under ~30 seconds.
- A test (`DemoSeederTest`) runs the full seed and asserts: 2 schools; the counts
  above are non-zero; no school-owned row has a `school_id` from another school in
  any of its references (the composite keys enforce this, but the test documents it);
  `family.parent@demo.school` gets 2 children from `/api/parent/children`.
- Clicking through each demo account above shows content on every page in its
  sidebar, in English and Arabic.
- `DatabaseSeeder` still seeds the base data alone when demo seeding is turned off.

## Open questions

- **School week:** which days are school days (Sun–Thu vs Mon–Fri) for attendance?
- **Currency / amounts:** which currency and realistic fee amounts?
- **Names:** Arabic/English name lists for the second school's students, or reuse the
  existing `StudentSeeder` style?
- **Zoom:** is a placeholder meeting link fine for demos, or should meetings be left
  out until Zoom is configured?
