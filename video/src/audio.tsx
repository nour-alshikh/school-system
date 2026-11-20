import { Audio, Sequence, getStaticFiles, interpolate, staticFile, useVideoConfig } from "remotion";
import { music, sfx, timeline } from "./config";
import { sec, sceneOrder, sceneStart } from "./lib/time";
import { assistantTimes } from "./scenes/Assistant";
import { draftTimes } from "./scenes/DraftWithAI";
import { moduleTimes } from "./scenes/Modules";

export type SfxName = keyof typeof sfx;
export type SfxAvailable = Record<SfxName, boolean>;

/**
 * Which SFX files exist in public/sfx, checked once before rendering
 * (Root's calculateMetadata). A missing file is simply skipped.
 */
export function findSfx(): SfxAvailable {
  const files = new Set(getStaticFiles().map((f) => f.name));
  return Object.fromEntries((Object.keys(sfx) as SfxName[]).map((name) => [name, files.has(sfx[name].file)])) as SfxAvailable;
}

/** Music at ~35%, 1s fade-in, 2s fade-out ending on the last frame. The 2:19 track is trimmed by the composition's end. */
export function Music() {
  const { durationInFrames, fps } = useVideoConfig();
  return (
    <Audio
      src={staticFile(music.file)}
      volume={(f) =>
        interpolate(f, [0, music.fadeIn * fps, durationInFrames - music.fadeOut * fps, durationInFrames - 1], [0, music.volume, music.volume, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      }
    />
  );
}

interface Cue {
  name: SfxName;
  /** Absolute frame. */
  at: number;
}

/**
 * Every sound effect, at the same frames the scenes use (each scene exports
 * its key frames): clicks on presses, pops when bubbles, chips and the
 * confirm card appear, a quiet whoosh on each scene change.
 */
export function sfxCues(): Cue[] {
  const cues: Cue[] = [];
  const add = (name: SfxName, base: number, ...frames: number[]) => frames.forEach((f) => cues.push({ name, at: base + f }));

  // Scene changes.
  sceneOrder.slice(1).forEach((s) => add("whoosh", sceneStart(s), 0));

  // Modules: each beat's frames are local to the beat.
  const m = moduleTimes();
  const mod = sceneStart("modules");
  const beat = (i: number) => mod + i * m.beat;
  const order = timeline.modules.order;
  add("click", beat(order.indexOf("attendance")), ...m.attendance.taps, m.attendance.save);
  add("pop", beat(order.indexOf("attendance")), m.attendance.save + 8);
  add("click", beat(order.indexOf("fees")), m.fees.payButton, m.fees.record);
  add("pop", beat(order.indexOf("fees")), m.fees.updated + 6);
  add("click", beat(order.indexOf("library")), m.library.filter, m.library.shared - 10);
  add("pop", beat(order.indexOf("library")), m.library.shared);

  // Draft with AI, English then Arabic.
  const d = draftTimes();
  const draft = sceneStart("draftWithAI");
  for (const t of [d.en, d.ar]) {
    add("click", draft, t.openPopover - 6, t.draft);
    add("pop", draft, t.openPopover, t.review + 8);
  }

  // Assistant.
  const a = assistantTimes();
  const asst = sceneStart("assistant");
  add("click", asst, a.ctrlAt, a.jAt, a.times.sendQ1 - 3, a.times.sendQ2 - 3, a.times.confirm);
  add("pop", asst, a.times.answerQ1, a.times.confirmCard, a.times.confirm + 14);

  return cues.sort((x, y) => x.at - y.at);
}

/** Plays the cues whose files exist. */
export function SoundEffects({ available }: { available: SfxAvailable }) {
  return (
    <>
      {sfxCues()
        .filter((c) => available[c.name])
        .map((c, i) => (
          <Sequence key={i} from={c.at} durationInFrames={sec(2)} layout="none">
            <Audio src={staticFile(sfx[c.name].file)} volume={sfx[c.name].volume} />
          </Sequence>
        ))}
    </>
  );
}
