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

## Step 1 — Admin dashboard UI ✅

Done. `frontend/src/features/admin-dashboard/`:

- `admin-dashboard-page.tsx` — greeting row (time-of-day greeting, date,
  academic year, quick actions gated by permission and plan features),
  KPI row, chart grid, and the full `Calendar` kept at the bottom
  (`#calendar`) since it's where admins manage events.
- `kpi-card.tsx` — number, ▲/▼ change badge, sparkline strip along the bottom.
- `charts.tsx` — attendance area chart (school days only, 0–100%), students
  by stage donut (≤ 4 colored stages, the rest folded into "Other"), fees
  charged vs collected bars. Chart colors from `--chart-1..5`, validated for
  color-blind separation in both themes. Recharts axes flip for Arabic.
- `panels.tsx` — needs attention (unmarked classes link to
  `/attendance?classroom=ID`, top 5 unpaid balances link to the student),
  recent activity, upcoming exams, mini calendar.
- `/attendance` now accepts `?classroom=` to preselect a classroom.
- shadcn `chart`, `card`, `badge` added (`recharts` dependency).

Follow-ups:

- [x] Admins lost the avatar uploader — "Change avatar" is in the avatar
      menu now (step 2).
- [ ] ~25 existing `<Button render={<Link />}>` elsewhere log a Base UI
      warning; add `nativeButton={false}` to them (done for the dashboard).
- [ ] Teachers KPI shows a number only — no teacher history to trend yet.

## Step 2 — App shell ✅

Done. `frontend/src/components/`:

- `app-nav.ts` — one nav model (`useNavSections`) shared by the sidebar,
  the mobile drawer and search. Sections: Overview, My portal (parent /
  student / teacher self-service), Academics, People, Finance,
  Communication, Administration, Platform; empty ones are hidden. Each
  link keeps its old permission / plan-feature gate. The most specific
  matching link is active (`/students/12` → All students). Meetings and
  My meetings are new in the nav (the pages existed but had no link).
- `site-sidebar.tsx` — full-height sticky sidebar beside the top bar
  (layout changed in `app/[locale]/layout.tsx`), brand + school name on
  top, section headings, teal tint + inline-start bar on the active link
  (flips in Arabic), groups open by themselves on their pages, icon-only
  mode with dividers, collapse and log out at the bottom.
- `site-header.tsx` — top bar: mobile menu (drawer below `md`), search,
  academic year, notifications, theme, language, avatar menu with
  "Change avatar" (dialog with `AvatarUploader`). Guests and the landing
  page keep the simple bar until step 3.
- `command-menu.tsx` — ⌘K / Ctrl K: pages from the nav, plus students by
  name or email for `manage-students`. Arrow keys + Enter.
- `academic-year-menu.tsx` — shows the current year and lists the others,
  with "Manage academic years". It does not switch years: `is_current` is
  school-wide, not a per-user view filter. Hidden for roles that can't
  read `/api/academic-years`.
- `notifications-menu.tsx` — the bell lists the system admin's
  announcements (`hooks/use-announcements.ts`), dismissible ones with ×.
  `AnnouncementsBanner` now shows only critical ones (they can't be
  dismissed); info and warning moved to the bell.

Follow-ups:

- [ ] A real per-user notifications feed (overdue fees, new exams, …) —
      the bell only has announcements today.
- [ ] Non-admin dashboards still show the old centered avatar uploader;
      drop it when they're redesigned in step 4.

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
