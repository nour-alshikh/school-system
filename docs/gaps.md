# Project Gaps

Snapshot of what this app is missing, as of 2026-09-22. The feature surface is
already large — students, fees, attendance, exams, meetings/Zoom, library
resources, calendar, promotions/graduations — across admin/teacher/parent/student
portals. These are the gaps found reviewing the codebase.

## Testing / CI

- Backend: only `tests/Feature/Auth/LoginTest.php` and the stock
  `ExampleTest.php`. No Feature tests for Students, Fees, Attendance, Exams,
  Promotions, or any other module — a large, untested surface.
- Frontend: zero tests. No `.test.*` / `.spec.*` files anywhere in `frontend/src`.
- No `.github/workflows` — no CI pipeline at all (no automated test run, lint, or
  build check on push/PR).

## Missing features

- **Notifications.** No `app/Mail`, no `app/Jobs`. `User` has Laravel's default
  notifiable trait but nothing actually sends anything. Parents aren't notified
  when a fee is charged, an exam is graded, or a student is marked absent.
- **Gradebook / report cards.** The `Grade` model is a grade *level* (e.g.
  "Grade 5"), not a score. Only the online `Exam` flow auto-grades. There's no
  manual score entry for offline tests/assignments, and no term report card.
- **Homework / assignments.** No model for this — matches on "assignment" in
  the codebase are all about classroom-subject-teacher assignment, unrelated.
- **Timetable / schedule.** No recurring weekly class-period grid — only
  ad-hoc `CalendarEvent` and `Meeting` (Zoom).
- **Online fee payment.** `FeePayment` is manual record-keeping only — no
  payment gateway integration (Stripe/PayPal/local gateway).
- **Queues.** No queue worker configured — bulk operations, Zoom calls, and any
  future notifications all run synchronously.

## Known/documented gaps

- `docs/multi-tenancy.md` — multi-school support (shared DB, `school_id` + memberships) is
  implemented, including a parent seeing all their children across schools in one
  view (see that doc's Decisions section).
- `docs/production-readiness.md` — covers per-record authorization, general API
  rate limiting, and moving off SQLite; worth re-checking these are actually
  merged, not just documented.

## Smaller items

- i18n covers `en`/`ar` only — fine if that's the intended scope.
- No audit/activity log for admin actions (who deleted a student, waived a fee,
  etc).
- Didn't verify whether `/students` (and similar index endpoints) support
  search/filter query params.

## Priority read

Biggest risk: **zero test coverage** given the size of the feature set.
Biggest product gap: **notifications** (parents are blind to fee/attendance/exam
events) and **gradebook/report cards**.
