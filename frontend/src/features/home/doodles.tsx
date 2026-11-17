"use client";

import { useEffect, useRef, type CSSProperties, type SVGProps } from "react";
import { cn } from "@/lib/utils";

// Small hand-drawn school doodles for the landing page. Decorative only:
// every one is aria-hidden and strokes with currentColor, so a text-* class
// picks its color. Paths use pathLength="1" so `.landing-draw`
// (globals.css) can draw them in.

type DoodleProps = SVGProps<SVGSVGElement> & { draw?: boolean; delay?: string };

/** Sets data-visible once the element is on screen, which starts the draw. */
function useDrawOnView(enabled: boolean | undefined) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.setAttribute("data-visible", "");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}

function Svg({ draw, delay, className, children, viewBox = "0 0 48 48", style, ...props }: DoodleProps) {
  const ref = useDrawOnView(draw);

  return (
    <svg
      ref={ref}
      aria-hidden
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(draw && "landing-draw", className)}
      style={{ ...style, ...(delay ? ({ "--draw-delay": delay } as CSSProperties) : {}) }}
      {...props}
    >
      {children}
    </svg>
  );
}

/** Four-point sparkle. */
export function Sparkle(props: DoodleProps) {
  return (
    <Svg {...props} viewBox="0 0 24 24">
      <path pathLength={1} fill="currentColor" stroke="none" d="M12 1.5c.6 4.6 2.4 7.4 7 8.5-4.6 1.1-6.4 3.9-7 8.5-.6-4.6-2.4-7.4-7-8.5 4.6-1.1 6.4-3.9 7-8.5Z" />
    </Svg>
  );
}

/** A loose underline squiggle, wide. */
export function Squiggle(props: DoodleProps) {
  return (
    <Svg {...props} viewBox="0 0 300 20" preserveAspectRatio="none" strokeWidth={5}>
      <path pathLength={1} d="M4 14C40 4 62 4 88 11s52 6 82-2 58-9 84 0 30 6 42 3" />
    </Svg>
  );
}

/** Open book. */
export function BookDoodle(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path pathLength={1} d="M24 14c-5-4-12-5-19-4v26c7-1 14 0 19 4 5-4 12-5 19-4V10c-7-1-14 0-19 4Z" />
      <path pathLength={1} d="M24 14v26" />
      <path pathLength={1} d="M10 17c3 0 6 .5 9 2M10 23c3 0 6 .5 9 2M29 19c3-1.5 6-2 9-2M29 25c3-1.5 6-2 9-2" />
    </Svg>
  );
}

/** Pencil at an angle. */
export function PencilDoodle(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path pathLength={1} d="M33 6l9 9-25 25-11 2 2-11L33 6Z" />
      <path pathLength={1} d="M28 11l9 9M8 31l9 9" />
    </Svg>
  );
}

/** Graduation cap. */
export function CapDoodle(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path pathLength={1} d="M4 18l20-9 20 9-20 9L4 18Z" />
      <path pathLength={1} d="M12 22v9c3 3 7 4.5 12 4.5s9-1.5 12-4.5v-9" />
      <path pathLength={1} d="M44 18v11" />
    </Svg>
  );
}

/** A ticked checkbox. */
export function CheckDoodle(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path pathLength={1} d="M10 8h28c1.5 0 2 .5 2 2v28c0 1.5-.5 2-2 2H10c-1.5 0-2-.5-2-2V10c0-1.5.5-2 2-2Z" />
      <path pathLength={1} d="M15 24l7 7 12-14" />
    </Svg>
  );
}

/** Ruler. */
export function RulerDoodle(props: DoodleProps) {
  return (
    <Svg {...props}>
      <path pathLength={1} d="M6 32L32 6l10 10-26 26L6 32Z" />
      <path pathLength={1} d="M13 25l4 4M19 19l3 3M24 14l4 4M30 8l3 3" />
    </Svg>
  );
}

/** Loose dashed loop, for connecting things. */
export function LoopArrow(props: DoodleProps) {
  return (
    <Svg {...props} viewBox="0 0 120 60">
      <path pathLength={1} d="M4 40c18-30 52-36 66-16 9 13-6 24-14 14-9-12 18-34 58-22" />
      <path pathLength={1} d="M106 8l9 8-11 5" />
    </Svg>
  );
}
