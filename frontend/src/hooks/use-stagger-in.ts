import { useGSAP } from "@gsap/react";
import { useRef, type RefObject } from "react";

import { DURATION, EASE, STAGGER, gsap } from "@/lib/gsap";

type UseStaggerInOptions = {
  selector: string;
  y?: number;
  stagger?: number;
  duration?: number;
};

export function useStaggerIn<T extends HTMLElement>(
  options: UseStaggerInOptions,
): RefObject<T | null> {
  const { selector, y = 16, stagger = STAGGER, duration = DURATION.base } = options;
  const ref = useRef<T>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.from(ref.current.querySelectorAll(selector), {
        opacity: 0,
        y,
        duration,
        stagger,
        ease: EASE,
      });
    },
    { scope: ref },
  );

  return ref;
}
