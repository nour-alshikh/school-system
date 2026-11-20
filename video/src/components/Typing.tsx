import { useCurrentFrame } from "remotion";
import { colors } from "../config";

/** How many characters of `text` are typed at `frame`. */
export function typedLength(frame: number, start: number, text: string, cps = 22, fps = 30) {
  return Math.max(0, Math.min(text.length, Math.floor(((frame - start) / fps) * cps)));
}

/** Frames it takes to type `text` at `cps` characters per second. */
export const typingFrames = (text: string, cps = 22, fps = 30) => Math.ceil((text.length / cps) * fps);

/**
 * Types `text` character by character from `start`, with a blinking 2px teal
 * caret. The caret hides `hideCaretAfter` frames after typing finishes
 * (pass Infinity to keep it).
 */
export function Typing({
  text,
  start,
  cps = 22,
  caret = true,
  hideCaretAfter = 20,
  caretColor = colors.teal,
}: {
  text: string;
  start: number;
  cps?: number;
  caret?: boolean;
  hideCaretAfter?: number;
  caretColor?: string;
}) {
  const frame = useCurrentFrame();
  const n = typedLength(frame, start, text, cps);
  const done = start + typingFrames(text, cps);
  const typing = frame >= start && frame < done;
  // Solid while typing, blinking (16-frame cycle) when idle.
  const visible = caret && frame >= start - 10 && frame < done + hideCaretAfter && (typing || Math.floor(frame / 16) % 2 === 0);

  return (
    <span style={{ whiteSpace: "pre-wrap" }}>
      {text.slice(0, n)}
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 2,
          height: "1.1em",
          marginInlineStart: 1,
          verticalAlign: "text-bottom",
          background: caretColor,
          opacity: visible ? 1 : 0,
        }}
      />
    </span>
  );
}
