# Design refresh plan

Status: **in progress** (started November 2026).

Make the landing page more modern and the dashboards richer, on a new
brand: deep teal + amber.

## Done

- **Brand colors** — `frontend/src/app/globals.css`. Lime replaced with deep
  teal `#0F766E` as `--primary`, amber `#F59E0B` as the new `--brand-accent`
  (`bg-brand-accent`, `text-brand-accent`), teal-tinted neutrals, a deep
  blue-teal dark mode, and five distinct chart colors (`--chart-1..5`:
  teal, amber, sky, rose, violet). `--accent` stays a neutral hover surface
  because shadcn uses it for menu and ghost-button hover.
- **Admin dashboard data** — `GET /api/admin/dashboard`
  (`backend/app/TypeScript/AdminDashboardType.php`, tested in
  `backend/tests/Feature/AdminDashboardTest.php`). On top of the original
  counts it returns:

  | Field | Feeds |
  |---|---|
  | `attendance_trend` (30 days: present/late/absent/excused) | attendance chart, attendance KPI sparkline |
  | `fees_by_month` (6 months: charged vs collected) | fees bar chart, fees KPI change |
  | `enrollments_by_month` (6 months) | students KPI sparkline and change |
  | `students_by_stage` (en + ar names) | donut |
  | `overdue_students_count`, `top_overdue` (top 5) | needs attention: overdue fees |
  | `is_school_day`, `classrooms_unmarked_today` | needs attention: classes not marked |
  | `low_attendance_students_count` (< 75% over 30 days, ≥ 5 records) | needs attention: low attendance |
  | `upcoming_exams` (next 5 published) | schedule & exams |
  | `recent_activity` (payments, new students, new exams; newest 8) | activity feed |

  Changes vs last period are computed on the frontend from these series.

## Design references

Flow AI output, in `docs/design/`:

- `landing-page.jpg` — landing page, light LTR + dark RTL, desktop + mobile.
- `admin-dashboard.jpg` — admin dashboard, light LTR + dark RTL.
- `role-dashboards.jpg` — teacher, parent, student dashboards.

Notes on the references:

- The admin dashboard is the strongest and is the main target.
- The landing page layout is good, but its body text is AI gibberish —
  write real English and Arabic copy in `frontend/messages/{en,ar}.json`.
- The three role dashboards drifted off-brand (solid teal sidebar, big
  amber pills, different font). Keep their content and layout ideas, but
  restyle them to the admin dashboard's look.

## Before starting

- `cd frontend && npm install` (`node_modules` is missing in this checkout).
- Read the chart/shadcn docs for the installed versions —
  `frontend/AGENTS.md` warns this Next.js differs from older versions.

## Step 1 — Admin dashboard UI

File: `frontend/src/features/admin-dashboard/admin-dashboard-page.tsx`.

- [ ] Add shadcn charts (`npx shadcn add chart`, uses Recharts); colors from `--chart-1..5`.
- [ ] Greeting row: "Good morning, {name}", date, quick actions (Add student,
      Take attendance, Record payment, New announcement).
- [ ] 4 KPI cards with sparkline + ▲/▼ % change: students (enrollments),
      teachers (number only, no trend data), attendance today (trend),
      fees collected (fees by month).
- [ ] Attendance area chart, last 30 days (8 cols); skip days with nothing marked.
- [ ] Students-by-stage donut (4 cols).
- [ ] Fees charged vs collected bar chart, 6 months (6 cols).
- [ ] Needs attention panel (6 cols): overdue fees (top 5 + count),
      unmarked classrooms, low-attendance count — each linking to its page.
- [ ] Recent activity feed (4 cols), sentences from `type` via i18n.
- [ ] Upcoming exams timeline (4 cols) — there is no class timetable, so exams only.
- [ ] Compact mini calendar (4 cols) in place of the full `Calendar`.
- [ ] Keep `OnboardingChecklist` at the top for new schools.
- [ ] Loading skeletons in the same grid; empty states for a brand-new school.
- [ ] Check RTL (charts read right-to-left, numbers stay LTR), dark mode, phone width.
- [ ] Add every new string to both `en.json` and `ar.json`.

## Step 2 — App shell

Files: `frontend/src/components/site-sidebar.tsx`, `site-header.tsx`.

- [ ] Sidebar grouped into sections (Overview, Academics, People, Finance,
      Communication), teal active indicator, collapsible icon-only mode.
- [ ] Top bar: search with ⌘K hint, academic year selector, notifications, avatar menu.

## Step 3 — Landing page

File: `frontend/src/features/home/home-page.tsx`.

- [ ] Sticky glass navbar (Features, Portals, Pricing, FAQ, language, Log in, Create your school).
- [ ] Hero: headline, subtext, two CTAs, real screenshot of the new admin
      dashboard in a tilted browser frame, with floating mini-cards and an amber badge.
- [ ] Stats strip (schools, students, uptime) with count-up.
- [ ] Bento feature grid (6 tiles with small UI previews: attendance,
      exam chart, invoice, library, calendar, class structure).
- [ ] Role portals tab switcher (Admin / Teacher / Parent / Student) with screenshots.
- [ ] How it works (3 steps), pricing from the existing plans, FAQ accordion,
      final CTA band, footer.
- [ ] GSAP scroll animations via the existing `useFadeIn` / `useStaggerIn` hooks;
      respect reduced motion.
- [ ] Real copy in English and Arabic; check both directions and both themes.

## Step 4 — Teacher, parent and student dashboards

Each needs backend data first (same pattern as `AdminDashboardType`), then UI
in the admin dashboard's style.

- [ ] **Teacher** (`TeacherDashboardType`): today's classes with "Take
      attendance", exams to grade, class performance chart, announcements.
- [ ] **Parent**: child switcher, attendance ring, latest grades, fees due
      card, upcoming meetings, announcements.
- [ ] **Student** (`StudentDashboardType`): today's schedule, upcoming exams
      with countdown, grade trend chart, borrowed books with due dates,
      announcements.
