import { useGSAP } from "@gsap/react";
import { useRef, type RefObject } from "react";

import { DURATION, EASE, STAGGER, gsap, onScrollIn, prefersReducedMotion } from "@/lib/gsap";

type UseStaggerInOptions = {
  selector: string;
  y?: number;
  stagger?: number;
  duration?: number;
  /** Wait until the container scrolls into view instead of playing on mount. */
  scroll?: boolean;
  /** Re-run the animation whenever one of these changes (e.g. `[data]`). */
  deps?: unknown[];
};

export function useStaggerIn<T extends HTMLElement>(
  options: UseStaggerInOptions,
): RefObject<T | null> {
  const {
    selector,
    y = 16,
    stagger = STAGGER,
    duration = DURATION.base,
    scroll = false,
    deps = [],
  } = options;
  const ref = useRef<T>(null);

  useGSAP(
    () => {
      if (!ref.current || prefersReducedMotion()) return;
      gsap.from(ref.current.querySelectorAll(selector), {
        opacity: 0,
        y,
        duration,
        stagger,
        ease: EASE,
        ...(scroll && { scrollTrigger: onScrollIn(ref.current) }),
      });
    },
    { scope: ref, dependencies: deps },
  );

  return ref;
}
