/**
 * Single source of truth for the promo video: size, fps, music tempo,
 * colours, all on-screen copy, and every timing (in seconds).
 * Changing captions, timings or the video size should mean editing only this file.
 */

export const video = {
  fps: 30,
  /** Square for LinkedIn. The wide composition (MainWide) uses `wide`. */
  width: 1080,
  height: 1080,
  wide: { width: 1920, height: 1080 },
  /** Total length in seconds (hard max 90). */
  duration: 75,
} as const;

export const music = {
  file: "music.mp3",
  /** Measured from public/music.mp3: steady 115 BPM, first beat at ~0.13s, 2:19 long. */
  bpm: 115,
  firstBeat: 0.127,
  volume: 0.35,
  fadeIn: 1,
  fadeOut: 2,
} as const;

export const sfx = {
  click: { file: "sfx/click.mp3", volume: 0.28 },
  pop: { file: "sfx/pop.mp3", volume: 0.25 },
  whoosh: { file: "sfx/whoosh.mp3", volume: 0.15 },
} as const;

/**
 * Video chrome colours (background, captions, eyebrows): the project's teal
 * and amber (frontend/src/app/globals.css: teal-700 primary, amber-500
 * accent). The real UI inside the cards keeps the app's own theme.
 */
export const colors = {
  base: "#f8f7f2",
  blobs: {
    teal: "#99e6dc",
    amber: "#fde4a0",
    sky: "#bfe3f5",
  },
  dots: "#d6d3c8",
  teal: "#0f766e",
  tealDeep: "#115e59",
  amber: "#f59e0b",
  amberStrong: "#b45309",
  /** Caption highlight word: teal to amber gradient text. */
  highlight: ["#0f766e", "#d97706"] as const,
  heading: "#0f172a",
  body: "#475569",
  label: "#64748b",
  successText: "#16a34a",
  successBg: "#dcfce7",
  card: "#ffffff",
  cardShadow: "0 40px 90px -30px rgba(30,41,59,.35)",
  hairline: "rgba(15,23,42,.06)",
} as const;

/** Sizes at the 1080px reference; layouts multiply by the scale unit `u` (lib/layout.ts). */
export const type = {
  caption: { size: 76, weight: 800, tracking: "-0.035em", left: 96, bottom: 110 },
  sub: { size: 26, weight: 500 },
  eyebrow: { size: 24, weight: 600, icon: 34, top: 72, left: 96 },
  cardRadius: 28,
  windowBar: 62,
} as const;

/** Motion constants, in frames (the brief's values). */
export const motion = {
  cardIn: 24,
  textIn: 18,
  textStagger: 5,
  fieldGap: 6,
  press: 8,
  ripple: 18,
  transition: 12,
  /** How long the amber AI ring stays on a filled field before fading. */
  ringHold: 30,
  ringFade: 15,
  cameraPush: 0.04,
} as const;

/** Scene windows in seconds; Main joins them with 12-frame transitions. */
export const scenes = {
  hook: { start: 0, end: 8 },
  modules: { start: 8, end: 28 },
  draftWithAI: { start: 28, end: 48 },
  assistant: { start: 48, end: 65 },
  portals: { start: 65, end: 72 },
  outro: { start: 72, end: 75 },
} as const;

/**
 * Key moments inside each scene, in seconds from the scene's start. Scenes
 * snap the important ones (presses, the confirm card, the logo) to the
 * nearest music beat via lib/time.ts `beatAt`.
 */
export const timeline = {
  hook: { icon: 0.3, fullLogo: 1.3, caption: 2.4, stats: 3.6 },
  modules: {
    /** Each module beat is this long; 5 beats fill the 20s scene. */
    beat: 4,
    order: ["attendance", "exams", "fees", "calendar", "library"] as const,
    attendance: { taps: [1.0, 1.45, 1.9], save: 2.8 },
    exams: { rows: 0.8, rowGap: 0.22 },
    fees: { payButton: 0.9, amount: 1.3, record: 2.3, updated: 2.6 },
    calendar: { events: 0.8, eventGap: 0.35 },
    library: { filter: 0.8, rows: 1.2, rowGap: 0.25, shared: 2.4 },
  },
  draftWithAI: {
    caption: 0.6,
    scrollToQuestions: 0.8,
    openPopover: 1.6,
    typeNotes: 2.0,
    draft: 4.8,
    fill: 5.7,
    questionGap: 1.0,
    review: 9.4,
    /** The Arabic beat: same flow in the Arabic UI. */
    arabic: 11.2,
    arabicTypeNotes: 12.0,
    arabicDraft: 14.2,
    arabicFill: 14.9,
    arabicReview: 17.2,
  },
  assistant: {
    caption: 0.9,
    ctrl: 0.5,
    j: 0.7,
    panel: 1.1,
    typeQ1: 2.0,
    sendQ1: 3.9,
    answerQ1: 5.1,
    typeQ2: 6.5,
    sendQ2: 8.5,
    answerQ2: 9.7,
    confirmCard: 10.0,
    confirm: 12.8,
  },
  portals: { tabs: [0.2, 1.4, 2.6, 3.8] as const, flip: 5.0, flipLength: 0.7 },
  outro: { logo: 0.1, tagline: 0.5, url: 0.8 },
} as const;

/**
 * The busiest moments to check before a full render (`npm run stills`), in
 * seconds from each scene's start. Rendered from Main, so transitions and
 * audio props are exactly as in the final video.
 */
export const stills = {
  hook: [5.0],
  modules: [3.3, 9.8, 19.6],
  draftWithAI: [4.0, 6.7, 10.0, 15.7, 18.2],
  assistant: [11.0, 14.0],
  portals: [3.3, 6.6],
  outro: [2.7],
} as const;

export const brand = {
  name: "School System",
  url: "school-system-neon.vercel.app",
} as const;

/** All on-screen copy. **word** marks the caption's one highlighted word. */
export const copy = {
  hook: {
    caption: "Run your entire school from **one** place.",
    sub: "Attendance, exams, fees, library and parents, in English and Arabic.",
    stats: "4 portals · 8 modules · 2 languages",
  },
  modules: {
    attendance: { eyebrow: "Attendance", caption: "Attendance in a **minute**." },
    exams: { eyebrow: "Exams & grades", caption: "Exams and **grades**." },
    fees: { eyebrow: "Fees & invoices", caption: "Fees, **tracked**." },
    calendar: { eyebrow: "Calendar", caption: "One **calendar** for everyone." },
    library: { eyebrow: "Library", caption: "A shared **library**." },
  },
  draftWithAI: {
    eyebrow: "Draft with AI",
    caption: "Write **less.**",
    sub: "Rough notes in → a ready form out. Nothing saves until you do.",
    review: "Review, then save",
    reviewAr: "راجِع ثم احفظ",
  },
  assistant: {
    eyebrow: "Assistant",
    caption: "Ask **anything.**",
    sub: "It answers, reports and sets things up, and asks before it acts.",
  },
  portals: {
    eyebrow: "Portals",
    caption: "A portal for **every** role.",
    sub: "Full Arabic, right-to-left.",
  },
  outro: {
    tagline: "Your whole school. **One** place.",
  },
} as const;
