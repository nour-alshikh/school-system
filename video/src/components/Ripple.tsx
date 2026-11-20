import type { ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { motion } from "../config";
import { pressScale } from "../lib/motion";

/** A white ripple expanding from the centre and fading out, from frame `at`. */
export function Ripple({ at, color = "rgba(255,255,255,.55)" }: { at: number; color?: string }) {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + motion.ripple) return null;
  const p = interpolate(frame, [at, at + motion.ripple], [0, 1]);

  return (
    <span aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "inherit", pointerEvents: "none" }}>
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "140%",
          aspectRatio: "1",
          borderRadius: "50%",
          background: color,
          transform: `translate(-50%, -50%) scale(${p})`,
          opacity: 1 - p,
        }}
      />
    </span>
  );
}

/**
 * Presses its child at `at`: scale 1→.95→1 plus a ripple. Wrap a real
 * Button; `radius` should match the button's corner radius.
 */
export function Press({ at, children, radius = 10, rippleColor }: { at: number; children: ReactNode; radius?: number; rippleColor?: string }) {
  const frame = useCurrentFrame();
  return (
    <span style={{ position: "relative", display: "inline-flex", borderRadius: radius, transform: `scale(${pressScale(frame, at)})` }}>
      {children}
      <Ripple at={at} color={rippleColor} />
    </span>
  );
}
