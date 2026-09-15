import { useGSAP } from "@gsap/react";
import { useRef, type RefObject } from "react";

import { DURATION, EASE, gsap } from "@/lib/gsap";

type UseFadeInOptions = {
  y?: number;
  delay?: number;
  duration?: number;
  /** Re-run the animation whenever one of these changes (e.g. `[isOpen]`). */
  deps?: unknown[];
};

export function useFadeIn<T extends HTMLElement>(
  options: UseFadeInOptions = {},
): RefObject<T | null> {
  const { y = 16, delay = 0, duration = DURATION.base, deps = [] } = options;
  const ref = useRef<T>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.from(ref.current, { opacity: 0, y, delay, duration, ease: EASE });
    },
    { scope: ref, dependencies: deps },
  );

  return ref;
}
