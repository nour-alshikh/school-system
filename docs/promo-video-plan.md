# Promo video plan (Remotion)

> **Status: parked.** Don't start this until the owner says to. When they do,
> work through the steps below in order. The full original brief is at the end
> ([Full brief](#full-brief)) and is the source of truth for every detail.

A 75-second LinkedIn product video for School System, built with Remotion in a
new, isolated `/video` folder with its own `package.json`. It must not be part
of the Next.js build and must not touch any existing app code.

## Before starting: fill these in

| What | Where it's used | Value |
| --- | --- | --- |
| Music BPM | beat-snapping of transitions and key moments (brief §6) | **TBD**: ask, or measure the track |
| Music length (mm:ss) | trim or loop with a crossfade (brief §6) | **TBD** |
| Full logo file | brief §2 `logo-full.png` | `frontend/public/logos/full-01.svg` (light) / `full-04.svg` (white words), or `full-01.png` |
| Icon logo file | brief §2 `logo-icon.png` | `frontend/public/logos/icon-01.svg` (or `.png`) |
| Music file | brief §2 `music.mp3` | `frontend/public/audio/corporate-upbeat.mp3` (copy to `/video/public/music.mp3`) |
| SFX | brief §2 `sfx/click.mp3`, `pop.mp3`, `whoosh.mp3` | not in the repo yet; skip any missing file without erroring |

Notes from the codebase, to settle when starting:

- **Brand colours differ from the brief's video palette.** The app is teal
  (`#1B6B6F`-ish, Tailwind teal-700 primary) with an amber accent, not indigo or
  violet. As the brief says: keep the project's colours for the real UI
  components, and use the brief's values for the video chrome (background,
  captions, eyebrows). Check whether the eyebrow, highlight and button gradients
  should move to teal and amber to match the logo; ask the owner.
- **Fonts.** The app uses Geist (Latin) and Cairo (Arabic) through `next/font`
  (`frontend/src/app/[locale]/layout.tsx`). Use them in the video instead of Inter.
- **Live URL** for the outro: `school-system-neon.vercel.app` (check it's still current).
- **Demo data to mirror in `mock.ts`:** `backend/database/seeders` (School System
  and Hilltop, EGP/USD, the seeded names), so the video matches what demo
  visitors see.

## Steps

### Step 1: Scaffold `/video`

- New folder `/video` with its own `package.json`, `tsconfig.json` (strict) and
  Remotion setup. Not referenced by the frontend's build, lint or tsconfig.
  Exclude it from the frontend tooling if needed.
- Copy the assets above into `/video/public` (logo files, `music.mp3`, any SFX).
- npm scripts: `preview`, `render`, `render:wide`, `stills` (brief §1).
- `.gitignore` for `/video/out` and `node_modules`.

### Step 2: Explore the UI and list what to reuse. **Stop and show the owner.**

- Find the real components for: the exam form and event form (Draft with AI),
  the AI assistant chat panel, the admin dashboard, attendance, fees and invoices,
  calendar, library, and the Admin/Teacher/Parent/Student portal views.
- For each, decide **reuse** (import from `frontend/src`) or **rebuild**
  (recreate faithfully from its markup and Tailwind classes), and note which
  providers it needs (next-intl, theme, query client, auth context) and what has
  to be stubbed (`next/navigation`, `next/image`, server actions).
- **Show this list to the owner before building anything** (brief §4).

### Step 3: Foundation

- `config.ts`: the single source of truth for all copy, timings in seconds, colours,
  fps, size and BPM. Changing captions, timings or size should mean editing only
  this file.
- `mock.ts`: all mock data. No network calls to the Laravel API.
- Providers wrapper plus Next.js stubs, so the real components render inside
  Remotion.
- Font loading that waits before the first frame (Latin + Arabic).
- Shared components: `Background` (driven by the global frame), `Card`,
  `Caption`, `Eyebrow`, `Typing`, `FieldFill`, `Ripple`, `Keycap`, `ChatBubble`,
  `ConfirmCard`. Motion only through `spring()`/`interpolate()` with
  `useCurrentFrame`; no CSS animations (brief §3).
- Layouts computed from the configured width and height (nothing hardcoded to
  1080), so 1920×1080 works.

### Step 4: Scenes, each its own Composition for previewing

Build and preview them one at a time (brief §5 has the beat-by-beat details):

1. **Hook** (0–8s): logo reveal, "Run your entire school from **one** place.", stat row.
2. **Modules** (8–28s): Attendance, Exams & grades, Fees, Calendar, Library (~4s each).
3. **Draft with AI** (28–48s, hero): notes typed, button press, fields fill with
   shimmer, review chip; then the Arabic beat.
4. **Assistant** (48–65s, hero): Ctrl+J, a data answer with a bar chart, the
   confirm-action card.
5. **Portals + Arabic** (65–72s): the four portal tabs, then the EN → العربية RTL flip.
6. **Outro** (72–75s): centred logo, tagline, URL, hold the last frame.

### Step 5: Assemble and add audio

- `Main.tsx`: `TransitionSeries` with soft cross-fade and blur transitions (~12 frames).
- Music at ~35%, 1s fade-in, 2s fade-out ending on the last frame; trim or loop
  to fit.
- Snap transitions and key moments to the beat (needs the BPM).
- SFX: click (presses), pop (bubbles, chips, confirm card), whoosh (transitions,
  quiet). Missing files are skipped.
- Every scene must still make sense muted (captions carry it).

### Step 6: Quality check, then render

- Run `stills` and inspect every image: no overflow or clipping, no fallback
  fonts, Arabic shaped correctly in RTL, no component broken by a missing
  provider, readable at phone size, captions not covering important UI.
- Fix, then do the full render: 1080×1080, exactly 75s, audio in sync.
- Report back: which components were reused vs rebuilt, how to change the copy,
  and how to render 1920×1080.

---

## Full brief

The owner's original prompt, unchanged.

```text
Create a promo video for this project (School System — Laravel API + Next.js frontend) using Remotion, in a new isolated folder /video with its own package.json. It must NOT be part of the Next.js build and must not touch any existing app code.

══════════════════════════════════════
1. OUTPUT
══════════════════════════════════════
- LinkedIn product video: 1080x1080, 30fps, total length 75 seconds (hard max 90s).
- Width/height must come from config so I can render 1920x1080 later with the layouts adapting (no hardcoded 1080 positions).
- npm scripts:
  - "preview" → Remotion Studio
  - "render" → /video/out/promo-1080x1080.mp4 (H.264, CRF 18, yuv420p)
  - "render:wide" → /video/out/promo-1920x1080.mp4
  - "stills" → renders PNG stills of the busiest frame in each scene to /video/out/stills

══════════════════════════════════════
2. ASSETS (already in /video/public)
══════════════════════════════════════
- Logo (full, icon + wordmark): /video/public/[logo-full.png]
- Logo (icon only, square): /video/public/[logo-icon.png]
- Music: /video/public/music.mp3, [X] BPM, length [mm:ss]
- SFX (if present): /video/public/sfx/click.mp3, pop.mp3, whoosh.mp3. If a file is missing, skip that sound without erroring.
Use staticFile() for all assets.

══════════════════════════════════════
3. STYLE — "Clean Light SaaS"
══════════════════════════════════════
Mood: calm, premium, trustworthy, modern EdTech. Lots of white space. Never busy.

Background (persistent across all scenes, one shared <Background/> component):
- Base color #f6f7fb.
- 3 large soft blurred blobs (CSS blur ~90px), slowly drifting with sin/cos of the frame:
  indigo #c7d2fe (top-left, ~620px), mint #a7f3d0 (bottom-right, ~560px), pink #fbcfe8 (top-right, ~380px, 35% opacity).
- Dot-grid overlay: radial dots #cbd5e1, 1.3px, 28px spacing, 50% opacity.

UI containers:
- White cards, 28px radius, shadow `0 40px 90px -30px rgba(30,41,59,.35)` plus a 1px hairline `rgba(15,23,42,.06)`.
- Optional fake window bar on cards: 62px tall, three grey dots, a small title label.

Colors:
- Primary gradient (buttons): #4f46e5 → #7c3aed, with shadow `0 14px 30px -10px rgba(79,70,229,.6)`.
- Caption highlight word: gradient text #4f46e5 → #16a34a.
- Success chip: text #16a34a on #dcfce7, pill shape.
- Text: #0f172a for headings, #475569 for body, #64748b for labels.
- If the project's Tailwind config defines brand colors that clearly differ, keep the project's colors for the real UI components and use the values above for the video chrome (background, captions, eyebrows).

Typography:
- Inter (or the project's main font if it has one). Load fonts with @remotion/google-fonts or local files and wait for them to load, so the first frames never flash a fallback font.
- Captions: 76px, weight 800, letter-spacing -0.035em, line-height 1, positioned bottom-left (left 96px, ~bottom 110px at 1080x1080). Exactly one word in each caption gets the gradient highlight.
- Sub-captions: 26px, weight 500, #475569, under the caption.
- Eyebrow at top-left of each scene: small gradient-square icon (or the icon logo, 34px) + "School System · <Scene name>" in #4f46e5, 24px, weight 600.
- Arabic text: use the project's Arabic font; if there isn't one, use Cairo or IBM Plex Sans Arabic. Arabic must render with dir="rtl" and correct shaping.

Motion language (spring()/interpolate() with useCurrentFrame only; NO CSS animations/transitions):
- Card entrance: rise 70px→0, scale .94→1, opacity 0→1, easeOutExpo-like (~24 frames).
- Text entrance: rise 30–40px + fade, ~18 frames, staggered 4–6 frames.
- Typing: character-by-character from a string, with a blinking 2px indigo caret.
- Form-field fill: fields fill one by one (~6 frames apart). While a field is filling: indigo border #818cf8 and a soft shimmer sweeping left→right (rgba(99,102,241,.18)). After it's filled: border #c7d2fe, background #f8faff.
- Button press: scale 1→.95→1 over ~8 frames, plus a white ripple expanding from the center and fading out.
- Camera: each scene slowly pushes in (scale 1→1.04 over the scene).
- Transitions: soft cross-fade with a slight blur (~12 frames) via @remotion/transitions. No hard cuts, no flashy wipes.
- Background blobs keep drifting continuously across scenes (driven by the global frame, not the scene frame).

══════════════════════════════════════
4. USE THE REAL UI
══════════════════════════════════════
- Import the project's actual components wherever possible: the exam form and event form (Draft with AI), the AI assistant chat panel, the admin dashboard, the attendance view, fees/invoices, calendar, library, and the portal views (Admin/Teacher/Parent/Student).
- First explore the codebase and list which components you'll reuse and which you'll have to rebuild. Show me that list before building.
- Feed everything mock data from /video/src/mock.ts and wrap components in whatever providers they need (i18n/next-intl, theme, query client, auth context). Mock or stub anything Next.js-specific (next/navigation, next/image, server actions).
- Make NO network calls to the Laravel API.
- If a component can't be imported cleanly, recreate it faithfully from its markup and Tailwind classes, not with a generic look.
- Render real components inside the white cards, scaled down if needed (transform: scale) so they're readable at 1080x1080. Text must stay legible on a phone screen; don't show whole pages at tiny sizes. Crop or zoom to the relevant part.

══════════════════════════════════════
5. STORYBOARD (75s = 2250 frames @30fps)
══════════════════════════════════════
Scene 1 — Hook (0–8s)
- The logo icon scales in with a gentle spring, then the full logo resolves.
- Caption: "Run your entire school from **one** place."
- Sub: "Attendance, exams, fees, library and parents, in English and Arabic."
- Small stat row fades in: "4 portals · 8 modules · 2 languages".

Scene 2 — Modules (8–28s), ~4s each, one real screen per beat in a white card, with eyebrow + short caption:
- Attendance: a classroom gets marked present/late/absent with quick taps. Caption "Attendance in a **minute**."
- Exams & grades: build an exam → results published. Caption "Exams and **grades**."
- Fees & invoices: a payment gets recorded, the balance updates. Caption "Fees, **tracked**."
- School calendar: events/holidays pop onto the calendar. Caption "One **calendar** for everyone."
- Library: resources get shared to a grade. Caption "A shared **library**."

Scene 3 — HERO: Draft with AI (28–48s)
- Eyebrow "School System · Draft with AI". A card shows the real "New exam" screen: rough-notes box on the left (dashed indigo border), the real exam form on the right.
- Notes get typed: "science midterm grade 8 / next thu 10am / 45 min, chapters 3–5"
- "✦ Draft with AI" gets pressed (ripple + click SFX).
- Fields fill one by one with shimmer: Title "Grade 8 Science Midterm", Grade "Grade 8", Subject "Science", Date "26 Nov · 10:00", Duration "45 minutes", Arabic title "اختبار منتصف الفصل – علوم" (RTL).
- Green chip "✓ Review, then save" + Save button spring in (pop SFX).
- Short beat: the same flow in Arabic: Arabic notes → the Arabic form fills (show the bilingual drafting).
- Caption: "Write **less.**" Sub: "Rough notes in → a ready form out. Nothing saves until you do."

Scene 4 — HERO: The Assistant (48–65s)
- Eyebrow "School System · Assistant".
- Big "Ctrl" + "J" keycaps press down (click SFX), then the real assistant panel opens from the top bar.
- The user types: "How many Grade 5 students were absent today?"
- Typing dots → assistant answers: "6 of 128 absent today, 2 excused." with a small 5-day bar chart growing in (today's bar highlighted).
- The user types: "Add a parents' meeting on Monday 30 Nov at 6pm"
- Confirmation card slides up: "Confirm action · Add event · Parents' meeting · Mon 30 Nov, 6:00 PM", with Confirm and Cancel buttons (pop SFX). Confirm gets pressed → success check.
- Caption: "Ask **anything.**" Sub: "It answers, reports and sets things up, and asks before it acts."

Scene 5 — Portals + Arabic (65–72s)
- Caption "A portal for **every** role."
- Tabs Admin / Teacher / Parent / Student switch automatically (~1.2s each), showing each real dashboard.
- Finale beat: the whole UI flips EN → العربية (layout mirrors to RTL in one smooth move). Sub: "Full Arabic, right-to-left."

Scene 6 — Outro (72–75s)
- Background stays; everything else fades. The full logo is centered with a spring.
- Tagline: "Your whole school. **One** place."
- URL below in #475569: school-system-neon.vercel.app
- Hold the last frame ~1s.

══════════════════════════════════════
6. AUDIO
══════════════════════════════════════
- music.mp3 at ~35% volume, 1s fade-in, 2s fade-out ending exactly at the last frame. If the track is longer than the video, trim it; if shorter, loop it with a crossfade.
- The track is [X] BPM: compute frames-per-beat and snap scene transitions and key moments (button presses, confirmation card, logo reveal) to the nearest beat.
- SFX at ~25–30% volume: click.mp3 on button and keycap presses, pop.mp3 when chat bubbles, chips and the confirm card appear, whoosh.mp3 (quiet, ~15%) on scene transitions.
- The video must also work with no sound, since most LinkedIn viewers watch muted. Every scene has to be understandable from its caption alone.

══════════════════════════════════════
7. CODE STRUCTURE
══════════════════════════════════════
/video
  /public            (assets already here)
  /src
    Root.tsx         (registers Main + each scene as its own Composition, for previewing alone)
    Main.tsx         (TransitionSeries joining the scenes + Audio)
    config.ts        (ALL copy, timings in seconds, colors, fps, size, BPM; single source of truth)
    mock.ts          (all mock data)
    /components      (Background, Card, Caption, Eyebrow, Typing, FieldFill, Ripple, Keycap, ChatBubble, ConfirmCard)
    /scenes          (Hook, Modules, DraftWithAI, Assistant, Portals, Outro)
- TypeScript strict. Timings in config are in seconds and converted to frames with fps.
- Changing any caption, the timings or the video size should only require editing config.ts.

══════════════════════════════════════
8. QUALITY CHECK (do this before the full render)
══════════════════════════════════════
- Run "stills" and inspect each image: no text overflow or clipping, no fallback fonts, Arabic shaped correctly in RTL, real components not broken by missing providers, everything readable at phone size, captions not covering important UI.
- Fix any issues, then do the full render and confirm the duration is 75s and the audio is in sync.
- Finally, tell me: which real components you reused vs rebuilt, how to change the copy, and how to render the 1920x1080 version.
```
