import { motion, music, scenes, video } from "../config";

/** Seconds to frames at the video's fps. */
export const sec = (s: number) => Math.round(s * video.fps);

/** Frames per beat of the music (115 BPM at 30fps is about 15.65). */
export const framesPerBeat = (60 / music.bpm) * video.fps;

/** The beat nearest to a frame (absolute frames from the start of the video). */
export const snapToBeat = (frame: number) => {
  const offset = music.firstBeat * video.fps;
  return Math.round(offset + Math.round((frame - offset) / framesPerBeat) * framesPerBeat);
};

export type SceneName = keyof typeof scenes;
export const sceneOrder = Object.keys(scenes) as SceneName[];

/** Absolute frame where a scene (and the transition into it) starts: its configured second, snapped to the beat. */
export function sceneStart(name: SceneName) {
  const s = sec(scenes[name].start);
  return s === 0 ? 0 : snapToBeat(s);
}

/**
 * A scene's length in frames. Every scene but the last is one transition
 * longer than the gap to the next scene's start, because TransitionSeries
 * overlaps neighbours by that much; the whole video stays at exactly
 * `video.duration`.
 */
export function sceneFrames(name: SceneName) {
  const next = sceneOrder[sceneOrder.indexOf(name) + 1];
  const end = next ? sceneStart(next) : sec(video.duration);
  return end - sceneStart(name) + (next ? motion.transition : 0);
}

/** Scene-local frame for `seconds` into scene `name`, snapped to the nearest music beat. */
export function beatAt(name: SceneName, seconds: number) {
  const start = sceneStart(name);
  return snapToBeat(start + sec(seconds)) - start;
}
