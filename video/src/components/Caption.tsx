import { Fragment } from "react";
import { useCurrentFrame } from "remotion";
import { colors, motion, type } from "../config";
import { useLayout } from "../lib/layout";
import { textIn } from "../lib/motion";

/** "Write **less.**" → the one **word** gets the teal→amber gradient. */
export function Highlighted({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span
            key={i}
            style={{
              backgroundImage: `linear-gradient(90deg, ${colors.highlight[0]}, ${colors.highlight[1]})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              paddingBottom: "0.08em",
            }}
          >
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * The scene caption, bottom-left: 76px/800 headline with one highlighted
 * word, an optional sub-caption, both entering with the text motion.
 */
export function Caption({
  text,
  sub,
  enterAt = 0,
  subEnterAt,
  maxWidth,
}: {
  text: string;
  sub?: string;
  enterAt?: number;
  /** Defaults to just after the caption. */
  subEnterAt?: number;
  maxWidth?: number;
}) {
  const frame = useCurrentFrame();
  const { u, width } = useLayout();
  const c = type.caption;

  return (
    <div
      style={{
        position: "absolute",
        left: c.left * u,
        bottom: c.bottom * u,
        maxWidth: maxWidth ?? width - 2 * c.left * u,
        fontFamily: "var(--font-geist-sans)",
      }}
    >
      <div
        style={{
          fontSize: c.size * u,
          fontWeight: c.weight,
          letterSpacing: c.tracking,
          lineHeight: 1,
          color: colors.heading,
          ...textIn(frame, enterAt, u),
        }}
      >
        <Highlighted text={text} />
      </div>
      {sub && (
        <div
          style={{
            marginTop: 18 * u,
            fontSize: type.sub.size * u,
            fontWeight: type.sub.weight,
            lineHeight: 1.35,
            color: colors.body,
            ...textIn(frame, subEnterAt ?? enterAt + motion.textStagger, u),
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
