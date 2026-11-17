# AI Assistant Plan

Status: **phases 1–4 done** (written 2026-11-17; decisions settled the same day). Related:
[self-service-schools-plan.md](./self-service-schools-plan.md) (signup and
the setup checklist), [central-dashboard-plan.md](./central-dashboard-plan.md)
(where "Draft with AI" started), [authorization.md](./authorization.md).

## Goal

Three things, built on one shared AI layer:

1. **Draft with AI across the app.** Anywhere someone writes something
   (an exam, an event, a meeting, a description, an Arabic/English pair),
   they can type rough notes or a request and get a filled-in draft to edit.
2. **An assistant chat** inside the app that helps people use the system:
   how to do things, answers about their school's data, and (later) doing
   things for them after they confirm.
3. **"Describe your school" on the landing page.** A visitor types something
   like *"A primary and preparatory school in Cairo, two classes per grade,
   fees per term"* and gets a ready school setup (stages, grades,
   classrooms, subjects, academic year, settings) to review before signing up.

## What exists today

| Piece | State |
|---|---|
| `App\Services\AnnouncementWriter` | The only AI feature. System admins' notes → bilingual announcement draft (title, body, level, audience) via OpenRouter. Saves nothing. |
| `POST /api/platform/announcements/draft` | Throttled 10/min. Button in `features/platform/announcements-page.tsx`. |
| `config/services.php` → `openrouter` | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (default a free Nemotron model). No key → the button says it isn't set up. Not set in the local `.env`. |
| JSON output | Asked for in the prompt and parsed leniently (the free model doesn't support `response_format`). |
| `SchoolStructureTemplate` | One fixed structure (3 stages, 12 grades, a classroom per section, usual subjects). Used by "Create a standard structure" in the setup checklist. |
| Signup | `/create-school`: school name, slug, admin account. The school starts empty. |
| Permissions / plan features | Spatie permissions (`manage-exams`, `manage-calendar`, …) and plan features (`fees`, `exams`, `meetings`, `library`) already gate every page and endpoint. |
| Bilingual data | Stages, grades, subjects, announcements … have `en` + `ar` fields, typed by hand today. |

## Decisions needed from the owner

| Question | Recommendation |
|---|---|
| **Which model/provider?** | **Decided (2026-11-17): same as announcements.** OpenRouter, the existing `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` (already working on the server), plain `chat/completions` calls, JSON asked for in the prompt and parsed leniently, validated in PHP. No native tool calling, `response_format` or streaming; the assistant's tools (phases 4–6) use the same JSON-reply pattern (see phase 5). Swapping the model later is a config change. |
| **Which plans get AI?** | **Decided:** `ai` in `Plan::FEATURES`, gated like `exams`; on Standard and Unlimited, not Basic (platform admins can change that per plan). Landing "describe your school" is free for everyone (it's how schools sign up). |
| **Can school data be sent to the AI provider?** | Drafts send only what the user typed. The assistant's data answers (phase 5) send the results of queries (names, attendance, fees). **Decided:** a per-school setting "Let the assistant read school data", off by default (added in phase 5), with a clear note; help-only mode works without it. |
| **Keep chat history?** | **Decided:** yes, per user, deleted after 30 days. Needed for "continue the conversation" and for debugging bad answers. |
| **Public endpoint for the landing input?** | **Decided:** yes, without login, but heavily throttled (see phase 2). |

## Design rules (all phases)

1. **AI never saves anything by itself.** Drafts fill a form; actions show a
   confirm card. The user presses the real Save / Confirm button, which goes
   through the existing endpoints, FormRequests and policies.
2. **The server enforces permissions, not the prompt.** Every tool the
   assistant can call runs as the signed-in user, scoped to their school,
   behind the same `can()` / plan-feature checks as the page. The prompt
   only lists tools the user is allowed to use, but that's a convenience,
   not the protection.
3. **Data from the database is untrusted.** A student name or a note can
   contain "ignore your instructions…". Tool results go back to the model
   as data; no tool can do anything that writes without the confirm step
   (rule 1), so an injected instruction can at most produce a wrong
   suggestion the user sees.
4. **Structured output, validated in PHP.** Every draft has a fixed JSON
   shape, validated like a request (lengths, enums, ids that must exist in
   this school). Bad output → a friendly "couldn't draft that, try again".
5. **Bilingual by default.** Anything with `en`/`ar` fields is drafted in
   both; Arabic written natively, not word-for-word.
6. **Works without AI.** No key, plan without `ai`, or provider down → the
   buttons hide or explain, and every form works by hand as today.
7. **Usage is logged and capped.** One row per call (user, school, feature,
   model, tokens, ms, ok/failed — not the content), with per-user and
   per-school daily caps, so cost can be watched from the central dashboard.

## Phases

Sizes: S ≈ half a day, M ≈ 1–2 days, L ≈ 3–5 days.

| # | Phase | Size | Depends on |
|---|---|---|---|
| 1 | AI foundation | M | — |
| 2 | Landing "Describe your school" | L | 1 |
| 3 | Draft with AI, wave 1 | L | 1 |
| 4 | Assistant v1: help | L | 1 |
| 5 | Assistant v2: answers from school data | L | 4 |
| 6 | Assistant v3: actions with confirmation | L | 5 |
| 7 | Draft with AI, wave 2 | M | 3, 5 |

Recommended order: **1 → 2 → 3 → 4**, then 5–7. Phase 2 first because it
changes signup (the first thing a new school sees) and reuses phase 1 fully.

### Phase 1 — AI foundation (M)

Backend:

- `App\Services\Ai\AiClient` — the OpenRouter call pulled out of
  `AnnouncementWriter` as is: `chat/completions` with system + user
  messages, `reasoning: {effort: low, exclude: true}`, 60s timeout,
  `isConfigured()`, the lenient JSON extraction (first `{` to last `}`),
  and error mapping (unreachable / non-2xx / not JSON → `RuntimeException`).
- `config/ai.php` — caps and on/off. Model and key stay in
  `services.openrouter` (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`); an
  optional per-task override can be added later if ever needed.
- `App\Services\Ai\Drafter` base: a draft kind = prompt + JSON shape +
  validator. `AnnouncementWriter` becomes the first kind (no behavior change).
- `ai_usage` table + `AiUsage` model (rule 7), daily caps, and a usage card
  on the central dashboard (calls, failures, tokens by school).
- `ai` plan feature; `ai_enabled` school setting (default on, admin can
  turn off); `POST /api/ai/draft/{kind}` with `throttle` + `can` per kind.

Frontend:

- `components/ai/ai-draft-button.tsx` — the "✦ Draft with AI" popover:
  notes textarea, Draft, a spinner, errors. Takes a `kind` and an
  `onDraft(values)` that calls `form.setValue` for each field.
- Fields filled by AI get a short amber highlight and an "Undo AI draft"
  link (restores the values from before).
- `useAiAvailable()` — hides AI UI when the plan, setting or key is missing.

Tests: drafter validation (bad JSON, missing language, unknown enum, ids from
another school rejected), caps, plan gating. `Http::fake()` for the provider.

**Done (2026-11-17).** As built:

- `AppServicesAiAiClient` (call, lenient JSON, caps, `ai_usage` log incl.
  failures as `unreachable` / `http_<status>` / `bad_reply`), `Drafter` base
  with helpers (`bilingual`, `text`, `enumValue`, `enumList`, `existingIds`),
  `Drafts` registry from `config('ai.drafts')` (empty until phase 3).
- `AnnouncementWriter` → `AiDraftsAnnouncementDrafter`; same prompt and
  route, now logged and capped.
- `POST /api/ai/draft/{kind}` (`AiDraftController`, `throttle:ai` 10/min):
  404 unknown kind, 403 no plan feature / `ai_enabled` off / kind's
  `authorize()`, 503 no key, 429 daily cap, 502 unusable reply.
- `AiAccess` decides availability; the user payload carries `ai_available`.
- Caps: 50/user and 300/school per day (`AI_USER_DAILY_CAP`,
  `AI_SCHOOL_DAILY_CAP`); `AI_ENABLED=false` turns everything off.
- `ai_enabled` setting: empty = on, toggle in Settings → General (shown only
  when the plan has `ai`).
- Central dashboard: "AI usage" card (today, 30-day calls / failures /
  tokens, top 10 schools), live outside the 10-minute cache.
- Frontend: `useAiDraft` (fill, undo, amber highlight via
  `ai.highlight(name)`), `AiDraftButton` (popover, dictation, Ctrl+Enter),
  `useAiAvailable`, `components/ui/popover.tsx`. No form uses them yet —
  that's phase 3.
- Tests: `tests/Feature/AiDraftTest.php` with `tests/Fakes/TestEventDrafter.php`.

### Phase 2 — Landing "Describe your school" (L)

The idea: a new school is empty, and setting it up (stages → grades →
classrooms → subjects → academic year) is the hardest part of signing up.
Let people describe it in a sentence and get it built.

Flow:

1. **Landing hero** gets an input under the headline: *"Describe your school…"*
   with 3 example chips (click fills the input) and a ✦ Build my school
   button. Arabic placeholder and examples on `/ar`.
2. `POST /api/school-blueprint` (public) → a **blueprint**:
   ```json
   {
     "school_name": {"en": "...", "ar": "..."},
     "slug": "nile-valley-school",
     "stages": [{"name": {"en","ar"}, "grades": [{"name": {"en","ar"}, "classrooms": ["A","B"]}]}],
     "subjects": [{"name": {"en","ar"}, "grades": ["Grade 1", "..."]}],
     "academic_year": {"name": "2026/2027", "starts_on": "...", "ends_on": "..."},
     "school_days": ["sun","mon","tue","wed","thu"],
     "currency": "EGP",
     "modules": ["fees","exams","library"],
     "notes": ["Assumed 2 classrooms per grade — change below"]
   }
   ```
   Missing details fall back to `SchoolStructureTemplate`'s defaults, and
   the blueprint says what it assumed (`notes`).
3. The visitor lands on **`/create-school?from=blueprint`** with the
   blueprint in `sessionStorage`. A preview panel beside the signup form
   shows the tree (stages › grades › classrooms, subjects, year, days) with
   inline edits: rename, add/remove a grade or classroom, toggle a subject,
   plus "Describe again" to refine ("add a secondary stage").
4. Signup creates the school **and applies the blueprint in one
   transaction**: `SchoolBlueprint::apply()` — the generalised form of
   `SchoolStructureTemplate` (which becomes "the default blueprint").
   The setup checklist then shows those steps as done.
5. Signed-in users adding a school get the same input on `/create-school`.

Abuse protection (public, costs money): throttle per IP (e.g. 5/hour) and
globally (daily cap → falls back to "use the standard structure"),
honeypot field as on signup, input max ~500 characters,
blueprint validated hard (max 4 stages, 15 grades, 6 classrooms per grade,
40 subjects). No school data involved — only what the visitor typed.

Tests: blueprint validation and limits, `apply()` builds exactly the
blueprint, signup with/without blueprint, throttle and fallback.

**Done (2026-11-17).** As built, where it differs from the sketch above:

- Shape uses the app's flat names: `stages: [{name_en, name_ar, grades:
  [{name_en, name_ar, classrooms: ["A","B"]}]}]`, `subjects: [{name_en,
  name_ar, stages: [stage index]}]`, `academic_year: 2026` (start year,
  like `academic_years.year`), `school_days: [0..6] | null`, `currency`,
  `school_name`, `slug`, `notes`. No `modules`: the plan decides those.
- `AppServicesSchoolBlueprint` (rules, limits, `default()`, `apply()`);
  `SchoolStructureTemplate::applyToEmptySchool()` now applies `default()`.
- `SchoolBlueprintDrafter` cleans the reply leniently (cuts to limits, drops
  items missing a language), then validates strictly.
- `POST /api/school-blueprint` never fails the visitor: no key, the daily
  cap (`AI_BLUEPRINT_DAILY_CAP`, 200) or a bad reply → the standard
  structure (or the one being refined, unchanged) with `fallback: true`.
  Throttle `school-blueprint`: 10/hour and 30/day per address. Honeypot.
- Signup (`/school-signup`, `POST /schools`) takes an optional `blueprint`
  and builds it in the same transaction; audit entry notes it.
- Guests' calls aren't charged to the default school (`AiClient` only
  attributes calls to a signed-in user's school).
- Frontend: `features/school-blueprint/` (describe box with example chips,
  tree editor, refine box, sessionStorage hand-off); hero box; `/create-school`
  shows the panel beside the form, or an optional "Describe your school" box.
- Per-address limits need the visitor's IP: the BFF now sends it with a
  shared secret (`BFF_SHARED_SECRET` on both sides, `TrustBffClientIp`;
  docs/authentication.md). Until it's set, every visitor shares one limit.

### Phase 3 — Draft with AI, wave 1 (L)

Each is a draft kind (phase 1) + the shared button on an existing form.
Ordered by value.

| Where | User types | AI fills | Size |
|---|---|---|---|
| **Exam builder** (`exams/new`, edit) | "10 MCQs on fractions for Grade 4, medium" or pastes a lesson | Questions with 4 options, the correct one, marks. Appended, never replacing existing ones. Uses the exam's subject and grade as context. | M |
| **Translate en ↔ ar** (stages, grades, subjects, classrooms, announcements, events …) | Nothing: a small ✦ button beside the empty language field | The other language from the one filled in | M |
| **Calendar event** | "Sports day next Thursday for primary, parents welcome" | Title, description, dates (relative dates resolved server-side from today in the school's time zone), all-day | S |
| **Meeting** (online lesson) | "Revision for the maths exam, grade 9" | Title, description / agenda | S |
| **Library resource** | Title (+ optional notes) | Description, suggested grades/subjects | S |
| **Platform announcements** | — | Moved onto the shared button (exists) | S |

**Done (2026-11-17).** As built:

- Kinds in `config/ai.php` → `App\Services\Ai\Drafts\*`: `exam_questions`
  (≤20 MCQs, 2–6 options, one correct; appended after written questions, a
  blank one dropped; title/instructions only if empty), `translate`
  (`{text}`, context `from` + `what`), `calendar_event` (date only if real
  and within a year), `meeting` (agenda; start time/length only if given and
  valid), `library_resource` (description; grade or subjects picked only
  from the ids the form offers). Each checks the form's permission and, via
  `Drafter::planFeature()`, its plan module.
- Translate lives in `LocaleTabs` (`translate` prop → `AiTranslateButton`):
  stages, grades, subjects, fees. Not student names.
- Meetings still need Zoom connected before the form opens at all.
- `OPENROUTER_URL` (default OpenRouter) lets a local fake stand in for the
  provider when checking the UI.

### Phase 4 — Assistant v1: help (L)

A chat panel for every signed-in user: a ✦ button in the top bar (and
Ctrl/⌘ J), opening a side sheet; full screen on mobile. Arabic/RTL aware.

What it knows:

- **Who's asking**: role, permissions, plan features, current page — so it
  only explains what this person can actually do.
- **How the system works**: a help knowledge base kept in the repo,
  `docs/help/{en,ar}/*.md`, one short page per feature (how to take
  attendance, set up a year, promote students, …). Small enough to send the
  relevant pages with each question (picked by the current page and simple
  keyword match) — no vector database needed yet.
- **Where things are**: the nav model (`components/app-nav.ts`), so answers
  end with buttons that link straight to the page ("Open Attendance").

Backend: `POST /api/assistant/messages` — a normal request/response (no
streaming, same as announcement drafts; the panel shows a typing
indicator). The model replies JSON: `{"reply": "...", "links": ["attendance"]}`,
links checked against the nav model. `assistant_conversations` / `assistant_messages` tables (30-day
cleanup job), caps from phase 1. Suggested starter questions per page
("How do I add a classroom?" on Classrooms).

Also: the setup checklist's empty school gets "Ask the assistant to help me
set up" which opens the chat with that question.

**Done (2026-11-17).** As built, where it differs from the sketch above:

- Help pages live in `backend/resources/help/{en,ar}/*.md` (not `docs/help`),
  so they ship with the backend. 20 pages, each with front matter: `title`,
  `pages` (paths it's about), `access` (permissions or `role:<name>`, any
  of), `feature` (plan module), `keywords`. `HelpLibrary` sends the overview
  plus up to 3 pages the user may read, scored by current page and keyword
  match (Arabic "ال" ignored). A test checks both languages have the same
  pages and gates.
- `Assistant` builds the prompt (role, permissions, plan modules, current
  page, the user's pages, help pages as reference) and sends the last 10
  turns via `AiClient::chat()` (multi-turn; `json()` now calls it). Reply
  `{"reply", "links"}`; links are paths, kept only if among the pages the
  frontend sent from the user's nav (max 3), and the frontend shows them
  only if still in its nav. Logged as feature `assistant`, same caps.
- Routes: `GET /api/assistant/conversation` (latest within 30 days),
  `POST /api/assistant/messages` (`throttle:assistant` 15/min), `DELETE
  /api/assistant/conversations` ("Clear history", works with AI off). Same
  refusals as drafts (`AiAccess`, plan feature `ai`). Nothing is saved when
  the call fails.
- `assistant:prune` deletes chats untouched for 30 days, scheduled daily in
  `routes/console.php` (needs `schedule:run` in cron); older ones are hidden
  before that anyway.
- Frontend: `features/assistant/` — ✦ in the top bar and Ctrl/⌘ J open a
  non-modal side sheet (stays open while following the steps; full screen
  on phones, closes when a link is followed there). Starter questions per
  page and role, typing indicator, Enter to send, New chat, Clear history.
  `openAssistant(question)` opens it from anywhere; the setup checklist of
  an empty school uses it ("Ask the assistant to help me set up").
- Cap messages now say "AI requests" instead of "AI drafts".

### Phase 5 — Assistant v2: answers from school data (L)

The assistant gets **read-only tools**, each a thin wrapper over existing,
permission-checked services/queries, returning small summaries:

| Tool | Who | Example question |
|---|---|---|
| `attendance_summary(date range, classroom?)` | `manage-attendance`, teachers (own classrooms) | "Who was absent today in 4-A?" |
| `low_attendance_students` | same | "Which students are below 75%?" |
| `fees_overview` / `overdue_students` | `manage-fees` | "Who still owes for this term?" |
| `exam_results(exam?)` | `manage-exams`, teachers (own), students/parents (own) | "How did 9-B do on the last quiz?" |
| `find_student(name)` | `manage-students` | "Show me Omar Khaled's profile" (returns a link) |
| `upcoming(range)` | everyone | "What's on next week?" |
| `my_child_summary` | parents | "How is Lina doing?" |

Gated by the school's "Let the assistant read school data" setting (see
decisions). Answers cite where numbers come from and link to the page.

How tools work without native tool calling (the announcement pattern):

1. The system prompt lists only the tools this user may use, each with a
   one-line description and its args.
2. The model replies JSON: `{"reply": "...", "tool": "attendance_summary",
   "args": {...}}`, or `"tool": null` when it can answer directly.
3. PHP checks the tool name is in the user's allowed list, validates the
   args like a FormRequest, and runs it as the user (rule 2). Unknown tool
   or bad args → treated as "no tool", a friendly "couldn't look that up".
4. The result goes back as a second call (as data, rule 3) and the model
   writes the final `reply`. Max 2 tool rounds per question.

Costs 2–3 calls per data answer and is less reliable than native tool
calling on long multi-step questions; fine for the one-tool questions above.

### Phase 6 — Assistant v3: actions with confirmation (L)

Write tools that **never run directly**: the model proposes (a JSON reply
with `"action": "...", "fields": {...}`, validated like phase 5), the chat shows
a confirm card (what will happen, editable fields), and Confirm calls the
normal API endpoint as the user. Start with low-risk ones:

- Create a calendar event / meeting.
- Draft an exam (opens the exam builder pre-filled, phase 3).
- Mark attendance from a sentence ("everyone present in 4-A except Salma,
  Omar late") → opens the attendance page pre-filled for review.
- Set up structure from a description (reuses the phase 2 blueprint on an
  existing school: "add a secondary stage with 3 classes per grade").

Never: deleting, payments, changing roles/permissions, anything in the
central dashboard.

### Phase 7 — Draft with AI, wave 2 (M)

Things that need school data (so after phase 5's data setting):

- **Student progress note** for parents (attendance + recent results →
  a short, kind summary a teacher reviews before sharing).
- **Fee reminder message** text for overdue families (once the app can
  send messages; today it can't — see gaps.md).
- **Settings → SEO** meta title/description from the school name and
  description.
- **Weekly summary** card on the admin dashboard ("This week: attendance
  91%, 3 classes unmarked Tuesday, 12 payments").

## Not in this plan

- Grading free-text answers (exams are multiple choice only today).
- Voice input, image/PDF upload to the assistant (later: "make an exam from
  this PDF" fits phase 3 once attachments are supported).
- Training or fine-tuning on school data.
- A school-wide announcements module for school admins (doesn't exist yet;
  would be another phase-3 draft kind when built).
