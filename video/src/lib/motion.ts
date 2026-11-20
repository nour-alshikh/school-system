import { Easing, interpolate } from "remotion";
import { motion } from "../config";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const expoOut = Easing.out(Easing.exp);

/** 0 to 1 over `duration` frames from `start`, easeOutExpo-like by default. */
export const progress = (frame: number, start: number, duration: number, easing = expoOut) =>
  interpolate(frame, [start, start + duration], [0, 1], { ...clamp, easing });

/** Card entrance: rise 70px to 0, scale .94 to 1, fade in (~24 frames). */
export function cardIn(frame: number, start = 0, u = 1) {
  const p = progress(frame, start, motion.cardIn);
  return { opacity: p, transform: `translateY(${70 * u * (1 - p)}px) scale(${0.94 + 0.06 * p})` };
}

/** Text entrance: rise ~34px and fade (~18 frames). */
export function textIn(frame: number, start = 0, u = 1) {
  const p = progress(frame, start, motion.textIn);
  return { opacity: p, transform: `translateY(${34 * u * (1 - p)}px)` };
}

/** Pop-in for bubbles, chips and cards: scale .9 to 1 with a little overshoot. */
export function popIn(frame: number, start = 0) {
  const p = progress(frame, start, 14, Easing.out(Easing.back(1.6)));
  const o = progress(frame, start, 8);
  return { opacity: o, transform: `scale(${0.9 + 0.1 * p})` };
}

/** Button press: scale 1 to .95 to 1 over ~8 frames. */
export function pressScale(frame: number, at: number) {
  return interpolate(frame, [at, at + motion.press / 2, at + motion.press], [1, 0.95, 1], clamp);
}

/** 1 to 0 over `duration` frames from `start`. */
export const fadeOut = (frame: number, start: number, duration = 12) =>
  1 - progress(frame, start, duration, Easing.inOut(Easing.ease));
