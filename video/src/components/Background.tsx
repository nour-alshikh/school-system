import { AbsoluteFill, useCurrentFrame } from "remotion";
import { colors } from "../config";
import { useLayout } from "../lib/layout";

/**
 * The persistent background: warm paper base, three slowly drifting blurred
 * blobs (teal, amber, sky) and a dot grid. Render it once at the root of
 * Main, outside the TransitionSeries, so it's driven by the global frame and
 * keeps drifting across scene changes.
 */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, u } = useLayout();
  const t = frame / 30;

  const blob = (size: number, color: string, x: number, y: number, opacity = 1): React.CSSProperties => ({
    position: "absolute",
    width: size * u,
    height: size * u,
    left: x - (size * u) / 2,
    top: y - (size * u) / 2,
    borderRadius: "50%",
    background: color,
    filter: `blur(${90 * u}px)`,
    opacity,
  });

  return (
    <AbsoluteFill style={{ background: colors.base, overflow: "hidden" }}>
      <div style={blob(620, colors.blobs.teal, width * 0.18 + Math.sin(t * 0.35) * 60 * u, height * 0.16 + Math.cos(t * 0.28) * 50 * u)} />
      <div style={blob(560, colors.blobs.amber, width * 0.86 + Math.cos(t * 0.3) * 60 * u, height * 0.86 + Math.sin(t * 0.33) * 55 * u, 0.85)} />
      <div style={blob(380, colors.blobs.sky, width * 0.84 + Math.sin(t * 0.42 + 1) * 45 * u, height * 0.12 + Math.cos(t * 0.37) * 40 * u, 0.35)} />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${colors.dots} ${1.3 * u}px, transparent ${1.3 * u}px)`,
          backgroundSize: `${28 * u}px ${28 * u}px`,
          opacity: 0.5,
        }}
      />
    </AbsoluteFill>
  );
};
