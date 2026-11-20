import { useLayoutEffect, useRef, useState } from "react";
import { useCurrentFrame } from "remotion";
import { useTranslations } from "next-intl";
import { ArrowUp, ArrowUpRight, CheckSquare, MessageSquarePlus, Sparkles, Trash2, X } from "lucide-react";
import { starterKeys } from "@/features/assistant/starters";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { assistantChat, assistantEvent, users } from "../../mock";
import { AssistantReply, TypingDots, UserBubble } from "../ChatBubble";
import { ConfirmCard } from "../ConfirmCard";
import { Press } from "../Ripple";
import { SuccessChip } from "../SuccessChip";
import { typedLength } from "../Typing";

export interface AssistantTimes {
  typeQ1: number;
  sendQ1: number;
  answerQ1: number;
  typeQ2: number;
  sendQ2: number;
  answerQ2: number;
  confirmCard: number;
  confirm: number;
}

/** Characters per second so `text` finishes typing a few frames before `until`. */
const cpsFor = (text: string, from: number, until: number) => (text.length * 30) / Math.max(1, until - from - 6);

/**
 * The assistant panel (features/assistant/assistant-panel.tsx), rebuilt with
 * its markup, real components and strings, driven by the frame: the intro and
 * suggestions, two questions typed and sent, "Thinking…", the answers
 * (rendered by the app's AssistantText) and the create-event action card.
 * Like the app, the message list keeps the newest message in view.
 */
export function AssistantPanelView({ times }: { times: AssistantTimes }) {
  const frame = useCurrentFrame();
  const t = useTranslations("Assistant");
  const tNav = useTranslations("Nav");
  const tStarters = useTranslations("Assistant.starters");

  const typing = frame < times.sendQ1 ? 1 : frame >= times.typeQ2 && frame < times.sendQ2 ? 2 : 0;
  const draft =
    typing === 1
      ? assistantChat.q1.slice(0, typedLength(frame, times.typeQ1, assistantChat.q1, cpsFor(assistantChat.q1, times.typeQ1, times.sendQ1)))
      : typing === 2
        ? assistantChat.q2.slice(0, typedLength(frame, times.typeQ2, assistantChat.q2, cpsFor(assistantChat.q2, times.typeQ2, times.sendQ2)))
        : "";
  const empty = frame < times.sendQ1;

  // Keep the newest message in view (the app scrolls its end into view).
  const area = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    if (!area.current || !list.current) return;
    const next = Math.min(0, area.current.clientHeight - list.current.offsetHeight - 32);
    if (next !== offset) setOffset(next);
  });

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b px-3">
        <Sparkles className="ms-1 size-4 text-brand-accent-strong" />
        <span className="me-auto ms-1 text-sm font-semibold">{t("title")}</span>
        <Button variant="ghost" size="icon-sm" disabled={empty}>
          <MessageSquarePlus className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm">
          <Trash2 className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm">
          <X className="size-4" />
        </Button>
      </header>

      <div ref={area} className="relative flex-1 overflow-hidden px-4 py-4">
        <div ref={list} className="flex flex-col gap-4 text-sm" style={{ transform: `translateY(${offset}px)` }}>
          {empty && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg bg-muted/50 p-3 leading-relaxed">
                <p>{t("intro", { name: users.admin.name.split(" ")[0] ?? "" })}</p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">{t("suggestions")}</p>
                <div className="flex flex-col items-start gap-2">
                  {starterKeys("/dashboard", ["admin"], true).map((key) => (
                    <span key={key} className="rounded-full border px-3 py-1.5 text-start text-sm">
                      {tStarters(key)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <UserBubble at={times.sendQ1}>{assistantChat.q1}</UserBubble>
          <TypingDots from={times.sendQ1 + 4} until={times.answerQ1} />
          <AssistantReply at={times.answerQ1} text={assistantChat.a1}>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm">
                <CheckSquare className="size-4" />
                <span className="max-w-56 truncate">{t("open_link", { page: tNav("attendance") })}</span>
                <ArrowUpRight className="size-3.5 opacity-60" />
              </Button>
            </div>
          </AssistantReply>

          <UserBubble at={times.sendQ2}>{assistantChat.q2}</UserBubble>
          <TypingDots from={times.sendQ2 + 4} until={times.answerQ2} />
          <AssistantReply at={times.answerQ2} text={assistantChat.a2}>
            <ConfirmCard fields={assistantEvent} at={times.confirmCard} confirmAt={times.confirm} />
            <div>
              <SuccessChip at={times.confirm + 14} size={13}>
                {t("actions.saved")}
              </SuccessChip>
            </div>
          </AssistantReply>
        </div>
      </div>

      <div className="shrink-0 border-t p-3">
        <div className="flex items-end gap-2 rounded-lg border bg-background p-1.5">
          <Textarea
            readOnly
            rows={1}
            value={draft}
            placeholder={t("placeholder")}
            className="max-h-36 min-h-9 resize-none border-0 bg-transparent px-2 py-1.5 shadow-none"
          />
          <Press at={(frame >= times.typeQ2 ? times.sendQ2 : times.sendQ1) - 3} radius={12}>
            <Button type="button" size="icon-sm" className="shrink-0" disabled={!draft.trim()}>
              <ArrowUp className="size-4" />
            </Button>
          </Press>
        </div>
      </div>
    </div>
  );
}
