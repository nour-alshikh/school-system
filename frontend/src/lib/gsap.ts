import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export const EASE = "power2.out";

export const DURATION = {
  fast: 0.25,
  base: 0.4,
  slow: 0.6,
} as const;

export const STAGGER = 0.06;

/** The person asked their system for less motion: skip entrance animations. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Plays once when the element scrolls 15% into the viewport. */
export function onScrollIn(trigger: Element) {
  return { trigger, start: "top 85%", once: true };
}

export { gsap, ScrollTrigger };
