# School System promo video

A 75-second LinkedIn product video built with [Remotion](https://www.remotion.dev/).
This folder is separate from the app: it has its own `package.json` and is not
part of the Next.js build. It imports real UI from `../frontend/src`, so the
frontend's dependencies must be installed (`cd ../frontend && npm install`).

## Commands

| Command | What it does |
| --- | --- |
| `npm run preview` | Remotion Studio. `Main` is the whole video; `Scene-<Name>` previews one scene. |
| `npm run render` | `out/promo-1080x1080.mp4` (H.264, CRF 18, yuv420p) |
| `npm run render:wide` | `out/promo-1920x1080.mp4`, same video with the layouts adapted |
| `npm run stills` | PNGs of each scene's busiest moments in `out/stills` (`stills:wide` for 1920×1080) |
| `npm run typecheck` | TypeScript (strict) |

## Changing things

Everything editable is in [`src/config.ts`](src/config.ts):

- **Copy:** `copy` holds every caption, sub-caption and eyebrow. Wrap the one
  highlighted word in `**…**`.
- **Timings:** `scenes` (when each scene starts, in seconds; changes snap to the
  music's beat) and `timeline` (key moments inside each scene).
- **Size:** `video.width` / `video.height` (and `video.wide` for `MainWide`).
  Layouts are computed from the size, nothing is hardcoded to 1080.
- **Colours, type sizes, motion constants, music volume and fades.**

Mock data (names, questions, amounts) is in [`src/mock.ts`](src/mock.ts).
The video never calls the API.

## Audio

`public/music.mp3` is the app's `corporate-upbeat.mp3` (115 BPM, measured).
Sound effects are optional: put `click.mp3`, `pop.mp3` and `whoosh.mp3` in
`public/sfx/` and they play on presses, pops and scene changes; missing files
are skipped.

## Real UI: reused vs rebuilt

**Reused** (imported from `frontend/src`): the `components/ui/*` primitives
(Button, Input, Textarea, Select, RadioGroup, Tabs, Table, Badge, Card, Label),
`KpiCard`, `Panel`, `RateRing`, `AssistantText`, `starterKeys`, the money and
number formatters, `globals.css` (theme), and every string from
`messages/en.json` / `ar.json`.

**Rebuilt** with the same markup and classes, driven by the frame instead of the
API and wall-clock state: the exam builder and its Draft with AI popover, the
assistant panel and its action card, the attendance, exam results, fees,
calendar and library screens, the top bar and the dashboard headers.

`remotion.config.ts` swaps Next.js routing, `next/image`, auth, school settings
and the API client for stubs in `src/stubs`, and CSS transitions/animations are
turned off so every frame is deterministic.
