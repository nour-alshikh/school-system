import type { ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { cn } from "@/lib/utils";
import { motion } from "../config";

/**
 * Where a field is in its AI fill at `frame`: the text typed so far, and how
 * strong the amber ring is. The ring mirrors the app's useAiDraft highlight
 * (ring-2 ring-brand-accent/70 bg-brand-accent/5): on while the field fills,
 * held for a moment, then faded out.
 */
export function fieldFillState(frame: number, value: string, at: number, typeFrames = 8) {
  const shown = frame < at ? "" : value.slice(0, Math.ceil(value.length * Math.min(1, (frame - at + 1) / typeFrames)));
  const holdEnd = at + typeFrames + motion.ringHold;
  const ring = interpolate(frame, [at - 1, at, holdEnd, holdEnd + motion.ringFade], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { shown, ring, filled: frame >= at + typeFrames, started: frame >= at };
}

/**
 * Wraps a real field (Input, Select trigger, Textarea...) and fills it at
 * `at`: `children` receives the text shown so far. The amber ring is drawn as
 * an overlay so the field's own classes stay exactly the app's.
 */
export function FieldFill({
  value,
  at,
  typeFrames = 8,
  className,
  radiusClassName = "rounded-lg",
  children,
}: {
  value: string;
  at: number;
  typeFrames?: number;
  className?: string;
  radiusClassName?: string;
  children: (shown: string, state: ReturnType<typeof fieldFillState>) => ReactNode;
}) {
  const frame = useCurrentFrame();
  const state = fieldFillState(frame, value, at, typeFrames);

  return (
    <div className={cn("relative", className)}>
      {children(state.shown, state)}
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 bg-brand-accent/5 ring-2 ring-brand-accent/70", radiusClassName)}
        style={{ opacity: state.ring }}
      />
    </div>
  );
}
