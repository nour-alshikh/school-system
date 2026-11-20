import { interpolate, useCurrentFrame } from "remotion";
import { colors, motion } from "../config";
import { useLayout } from "../lib/layout";

/** A big keyboard key that presses down at `at` (and comes back up). */
export function Keycap({ label, at, minWidth = 150 }: { label: string; at: number; minWidth?: number }) {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const down = interpolate(frame, [at, at + 3, at + motion.press + 4, at + motion.press + 10], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const depth = 10 * u;

  return (
    <div
      style={{
        minWidth: minWidth * u,
        height: 150 * u,
        padding: `0 ${40 * u}px`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 26 * u,
        background: "#ffffff",
        border: `1px solid ${colors.hairline}`,
        boxShadow: `0 ${depth * (1 - down) + 2 * u}px 0 #d9d6cc, 0 ${30 * u}px ${60 * u}px -${24 * u}px rgba(30,41,59,.35)`,
        transform: `translateY(${depth * down}px)`,
        fontFamily: "var(--font-geist-sans)",
        fontSize: 56 * u,
        fontWeight: 600,
        color: down > 0.5 ? colors.teal : colors.heading,
      }}
    >
      {label}
    </div>
  );
}
