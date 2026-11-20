import { useCurrentFrame } from "remotion";
import { useTranslations } from "next-intl";
import { AssistantText } from "@/features/assistant/assistant-text";
import { popIn, textIn } from "../lib/motion";

/**
 * The assistant panel's user bubble (assistant-panel.tsx UserBubble, same
 * classes), popping in at `at`. `children` lets a scene type the text in.
 */
export function UserBubble({ at, children }: { at: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <div
      className="ms-8 self-end whitespace-pre-wrap rounded-2xl rounded-ee-sm bg-primary px-3 py-2 text-primary-foreground"
      dir="auto"
      style={{ ...popIn(frame, at), transformOrigin: "100% 100%" }}
    >
      {children}
    </div>
  );
}

/** The "Thinking…" row with three bouncing dots, driven by the frame (not CSS animate-bounce). */
export function TypingDots({ from, until }: { from: number; until: number }) {
  const frame = useCurrentFrame();
  const t = useTranslations("Assistant");
  if (frame < from || frame >= until) return null;

  return (
    <div className="flex items-center gap-2 text-muted-foreground" style={popIn(frame, from)}>
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-current"
            style={{ transform: `translateY(${-Math.max(0, Math.sin(((frame - from) / 30) * Math.PI * 2.4 - i * 0.9)) * 4}px)` }}
          />
        ))}
      </span>
      <span className="text-xs">{t("thinking")}</span>
    </div>
  );
}

/** An assistant reply, rendered by the app's own AssistantText (bold, lists). */
export function AssistantReply({ at, text, children }: { at: number; text: string; children?: React.ReactNode }) {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <div className="flex flex-col gap-2" style={textIn(frame, at, 0.5)}>
      <div className="leading-relaxed">
        <AssistantText text={text} />
      </div>
      {children}
    </div>
  );
}
