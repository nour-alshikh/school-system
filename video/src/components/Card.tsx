import type { CSSProperties, ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { colors, type } from "../config";
import { useLayout } from "../lib/layout";
import { cardIn } from "../lib/motion";

/**
 * A white video card (28px radius, soft shadow, hairline) with an optional
 * fake window bar. Enters with the card motion at `enterAt` (scene frames).
 * `zoom` scales the real UI inside so it stays legible on a phone.
 */
export function Card({
  children,
  title,
  enterAt = 0,
  width,
  height,
  zoom = 1,
  style,
  contentClassName,
}: {
  children: ReactNode;
  /** Shows the window bar with this label. */
  title?: string;
  enterAt?: number;
  width: number;
  height?: number;
  zoom?: number;
  style?: CSSProperties;
  contentClassName?: string;
}) {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const bar = type.windowBar * u;

  return (
    <div
      style={{
        width,
        height,
        background: colors.card,
        borderRadius: type.cardRadius * u,
        boxShadow: `${colors.cardShadow}, 0 0 0 1px ${colors.hairline}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        ...cardIn(frame, enterAt, u),
        ...style,
      }}
    >
      {title !== undefined && (
        <div
          style={{
            height: bar,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 10 * u,
            padding: `0 ${26 * u}px`,
            borderBottom: `1px solid ${colors.hairline}`,
          }}
        >
          {["#e2e1dc", "#e2e1dc", "#e2e1dc"].map((c, i) => (
            <span key={i} style={{ width: 13 * u, height: 13 * u, borderRadius: "50%", background: c }} />
          ))}
          <span style={{ marginInlineStart: 14 * u, fontSize: 19 * u, fontWeight: 500, color: colors.label, fontFamily: "var(--font-geist-sans)" }}>
            {title}
          </span>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
        <div
          className={contentClassName}
          // Anchored top-left absolutely: in RTL a wider-than-parent block would otherwise overflow to the left.
          style={{ position: "absolute", top: 0, left: 0, transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%`, height: `${100 / zoom}%` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
