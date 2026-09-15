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

export { gsap, ScrollTrigger };
