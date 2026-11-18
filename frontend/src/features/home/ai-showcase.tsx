"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  CalendarPlus,
  Check,
  CheckCircle2,
  ClipboardList,
  Database,
  Languages,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Undo2,
} from "lucide-react";
import { useFadeIn } from "@/hooks/use-fade-in";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { prefersReducedMotion } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/features/home/section-heading";
import { intlLocale } from "@/features/admin-dashboard/utils";

/*
 * "AI built in" on the landing page: two hands-on demos of what the app's
 * AI does (docs/ai-assistant-plan.md) — Draft with AI filling a form, and
 * the assistant answering in its side panel. Both are scripted: a visitor
 * plays with real UI but nothing is sent to an AI provider, so the public
 * page costs nothing and can't be abused. Each demo says so.
 */

/** Text that types itself out while `active`; shown whole under reduced motion. */
function useTypewriter(text: string, active: boolean, cps = 55, onDone?: () => void) {
  const [count, setCount] = useState(0);
  const done = useRef(onDone);

  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (!active) return;
    // Every update comes from a timer, so a restart begins at 0 on its first tick.
    let i = 0;
    const step = prefersReducedMotion() ? text.length : Math.max(1, Math.round(text.length / 90));
    const timer = setInterval(() => {
      i = Math.min(text.length, i + step);
      setCount(i);
      if (i >= text.length) {
        clearInterval(timer);
        done.current?.();
      }
    }, prefersReducedMotion() ? 0 : 1000 / cps);
    return () => {
      clearInterval(timer);
      setTimeout(() => setCount(0), 0);
    };
  }, [text, active, cps]);

  return active ? text.slice(0, count) : "";
}

/** setTimeout that's cleared on unmount or when called again; instant under reduced motion. */
function useLater() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return {
    later(fn: () => void, ms: number) {
      timers.current.push(setTimeout(fn, prefersReducedMotion() ? 0 : ms));
    },
    clear() {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
  };
}

function DemoBadge() {
  const t = useTranslations("AiShowcase");
  return (
    <span className="rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {t("demoBadge")}
    </span>
  );
}

function DemoCard({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle: string; children: ReactNode }) {
  return (
    <div data-animate="demo" className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xl shadow-primary/5 dark:shadow-black/30">
      <div className="flex items-start justify-between gap-3 border-b bg-muted/30 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent/15 text-brand-accent-strong dark:text-brand-accent">
            {icon}
          </span>
          <div className="flex flex-col">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <DemoBadge />
      </div>
      <div className="flex flex-1 flex-col p-5">{children}</div>
    </div>
  );
}

// ─── Draft with AI ──────────────────────────────────────────────────────

type DraftKind = "event" | "exam" | "translate";
type DraftPhase = "idle" | "typing" | "thinking" | "filled";

const DRAFT_KINDS: { kind: DraftKind; icon: typeof CalendarPlus }[] = [
  { kind: "event", icon: CalendarPlus },
  { kind: "exam", icon: ClipboardList },
  { kind: "translate", icon: Languages },
];

/** Next Thursday, as the calendar drafter would resolve "next Thursday". */
function nextThursday(locale: string): string {
  const d = new Date();
  // "Next Thursday" said on Wednesday means the week after, not tomorrow.
  const days = (4 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (days < 3 ? days + 7 : days));
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", day: "numeric", month: "short" }).format(d);
}

function DraftField({ label, value, flash, multiline, dir }: { label: string; value: string; flash: boolean; multiline?: boolean; dir?: "rtl" | "ltr" }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div
        dir={dir}
        className={cn(
          "rounded-md border bg-background px-3 py-2 text-sm transition-[box-shadow,background-color] duration-700",
          multiline ? "min-h-16 leading-relaxed" : "min-h-9",
          !value && "text-muted-foreground/50",
          flash && "bg-brand-accent/10 ring-2 ring-brand-accent/70"
        )}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function DraftDemo() {
  const t = useTranslations("AiShowcase");
  const locale = useLocale();
  const [kind, setKind] = useState<DraftKind>("event");
  const [phase, setPhase] = useState<DraftPhase>("idle");
  const [flash, setFlash] = useState(false);
  const { later, clear } = useLater();

  const notes = t(`draft.${kind}.notes`);
  const typed = useTypewriter(notes, phase === "typing", 60, () =>
    later(() => {
      setPhase("thinking");
      later(() => {
        setPhase("filled");
        setFlash(true);
        later(() => setFlash(false), 2200);
      }, 1100);
    }, 250)
  );

  function pick(next: DraftKind) {
    clear();
    setKind(next);
    setPhase("idle");
    setFlash(false);
  }

  function undo() {
    clear();
    setPhase("idle");
    setFlash(false);
  }

  const filled = phase === "filled";
  const busy = phase === "typing" || phase === "thinking";
  const date = useMemo(() => nextThursday(locale), [locale]);

  return (
    <DemoCard icon={<Sparkles className="size-4.5" />} title={t("draftTitle")} subtitle={t("draftSubtitle")}>
      <div role="tablist" aria-label={t("draftPick")} className="mb-4 flex flex-wrap gap-2">
        {DRAFT_KINDS.map(({ kind: k, icon: Icon }) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => pick(k)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
              kind === k ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
            {t(`draft.${k}.tab`)}
          </button>
        ))}
      </div>

      {/* The popover the real button opens: notes in, Draft. */}
      <div className="mb-4 rounded-xl border border-brand-accent/40 bg-brand-accent/5 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand-accent-strong dark:text-brand-accent">
          <Sparkles className="size-3.5" />
          {kind === "translate" ? t("draftTranslateLabel") : t("draftNotesLabel")}
        </p>
        <p className="min-h-10 rounded-md bg-background px-3 py-2 text-sm" aria-live="polite">
          {phase === "idle" ? <span className="text-muted-foreground">{notes}</span> : phase === "typing" ? typed : notes}
          {phase === "typing" && <span className="ms-0.5 inline-block h-4 w-px animate-pulse bg-foreground align-middle" />}
        </p>
        <div className="mt-2 flex items-center justify-end gap-3">
          {filled && (
            <button type="button" onClick={undo} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline">
              <Undo2 className="size-3.5" />
              {t("draftUndo")}
            </button>
          )}
          <button
            type="button"
            disabled={busy || filled}
            onClick={() => setPhase("typing")}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-[opacity,scale] hover:opacity-90 active:scale-95 disabled:opacity-60"
          >
            {phase === "thinking" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {phase === "thinking" ? t("draftDrafting") : kind === "translate" ? t("draftTranslateButton") : t("draftButton")}
          </button>
        </div>
      </div>

      {/* The form it fills. */}
      <div className="flex flex-1 flex-col gap-3">
        {kind === "event" && (
          <>
            <DraftField label={t("draft.event.titleLabel")} value={filled ? t("draft.event.title") : ""} flash={flash} />
            <div className="grid grid-cols-2 gap-3">
              <DraftField label={t("draft.event.dateLabel")} value={filled ? date : ""} flash={flash} />
              <DraftField label={t("draft.event.audienceLabel")} value={filled ? t("draft.event.audience") : ""} flash={flash} />
            </div>
            <DraftField label={t("draft.event.descriptionLabel")} value={filled ? t("draft.event.description") : ""} flash={flash} multiline />
          </>
        )}
        {kind === "exam" && (
          <ol className="flex flex-col gap-2.5">
            {[1, 2].map((n) => (
              <li
                key={n}
                className={cn(
                  "rounded-lg border bg-background p-3 text-sm transition-[box-shadow,background-color,opacity] duration-700",
                  filled ? "opacity-100" : "opacity-40",
                  filled && flash && "bg-brand-accent/10 ring-2 ring-brand-accent/70"
                )}
              >
                <p className="mb-2 font-medium">
                  {n}. {filled ? t(`draft.exam.q${n}`) : t("draft.exam.placeholder")}
                </p>
                {filled && (
                  <ul className="grid grid-cols-2 gap-1.5">
                    {[1, 2, 3, 4].map((o) => {
                      const correct = o === (n === 1 ? 2 : 3);
                      return (
                        <li
                          key={o}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                            correct && "border-primary/50 bg-primary/10 font-medium text-primary dark:text-teal-300"
                          )}
                        >
                          {correct ? <CheckCircle2 className="size-3.5" /> : <span className="size-3.5 rounded-full border" />}
                          {t(`draft.exam.q${n}o${o}`)}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
            {filled && <p className="text-xs text-muted-foreground">{t("draft.exam.more")}</p>}
          </ol>
        )}
        {kind === "translate" && (
          <div className="grid gap-3">
            <DraftField label={t("draft.translate.enLabel")} value={t("draft.translate.en")} flash={false} multiline dir="ltr" />
            <DraftField label={t("draft.translate.arLabel")} value={filled ? t("draft.translate.ar") : ""} flash={flash} multiline dir="rtl" />
          </div>
        )}
      </div>

      <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">{t("draftFooter")}</p>
    </DemoCard>
  );
}

// ─── Assistant ──────────────────────────────────────────────────────────

type Scenario = "help" | "data" | "action" | "other";

interface ChatTurn {
  id: number;
  scenario: Scenario;
  question: string;
}

const STARTERS: Exclude<Scenario, "other">[] = ["help", "data", "action"];

/** Which scripted answer a typed question gets: the closest starter by keywords, else "other". */
function route(text: string, keywords: Record<Exclude<Scenario, "other">, string>): Scenario {
  const lower = text.toLowerCase();
  for (const scenario of STARTERS) {
    if (keywords[scenario].split(",").some((k) => k.trim() && lower.includes(k.trim().toLowerCase()))) return scenario;
  }
  return "other";
}

function AssistantReply({ turn, onSettled }: { turn: ChatTurn; onSettled: () => void }) {
  const t = useTranslations("AiShowcase");
  const [stage, setStage] = useState<"thinking" | "typing" | "done">("thinking");
  const [confirmed, setConfirmed] = useState(false);
  const { later } = useLater();
  const text = t(`chat.${turn.scenario}.reply`);

  useEffect(() => {
    later(() => setStage("typing"), 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typed = useTypewriter(text, stage !== "thinking", 70, () => {
    setStage("done");
    onSettled();
  });

  if (stage === "thinking") {
    return (
      <div className="flex w-fit items-center gap-1 rounded-2xl rounded-ss-sm bg-muted px-3 py-2.5" aria-label={t("chatThinking")}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex max-w-[92%] flex-col gap-2">
      <p className="rounded-2xl rounded-ss-sm bg-muted px-3 py-2 text-sm leading-relaxed whitespace-pre-line">{typed}</p>

      {stage === "done" && turn.scenario === "help" && (
        <span className="inline-flex w-fit items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs font-medium">
          {t("chat.help.link")}
          <ArrowRight className="size-3.5 rtl:rotate-180" />
        </span>
      )}

      {stage === "done" && turn.scenario === "data" && (
        <ul className="flex flex-col gap-1 rounded-lg border bg-background p-2 text-xs">
          {[1, 2].map((n) => (
            <li key={n} className="flex items-center justify-between gap-2">
              <span>{t(`chat.data.student${n}`)}</span>
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-700 dark:text-rose-300">{t(`chat.data.status${n}`)}</span>
            </li>
          ))}
          <li className="mt-1 border-t pt-1 text-muted-foreground">{t("chat.data.source")}</li>
        </ul>
      )}

      {stage === "done" && turn.scenario === "action" && (
        <div className="flex flex-col gap-2 rounded-lg border border-brand-accent/40 bg-brand-accent/5 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            <CalendarPlus className="size-4 text-brand-accent-strong dark:text-brand-accent" />
            {t("chat.action.cardTitle")}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground">{t("chat.action.cardEvent")}</span> · {t("chat.action.cardDate")}
          </p>
          {confirmed ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-primary dark:text-teal-300">
              <Check className="size-3.5" />
              {t("chat.action.done")}
            </p>
          ) : (
            <div className="flex justify-end gap-2">
              <span className="px-2 py-1 text-xs text-muted-foreground">{t("chat.action.dismiss")}</span>
              <button
                type="button"
                onClick={() => setConfirmed(true)}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-[opacity,scale] hover:opacity-90 active:scale-95"
              >
                <Check className="size-3.5" />
                {t("chat.action.confirm")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssistantDemo() {
  const t = useTranslations("AiShowcase");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const keywords = {
    help: t("chat.help.keywords"),
    data: t("chat.data.keywords"),
    action: t("chat.action.keywords"),
  };

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  });

  function ask(question: string, scenario: Scenario) {
    if (busy || !question.trim()) return;
    setBusy(true);
    setTurns((prev) => [...prev.slice(-4), { id: nextId.current++, scenario, question: question.trim() }]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    ask(input, route(input, keywords));
    setInput("");
  }

  return (
    <DemoCard icon={<Sparkles className="size-4.5" />} title={t("chatTitle")} subtitle={t("chatSubtitle")}>
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-background">
        {/* The side panel's header, with its shortcut. */}
        <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <Sparkles className="size-4 text-brand-accent-strong dark:text-brand-accent" />
            {t("chatPanelTitle")}
          </span>
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline">Ctrl J</kbd>
        </div>

        <div ref={scroller} className="flex h-72 flex-col gap-3 overflow-y-auto p-3" aria-live="polite">
          {turns.length === 0 && (
            <div className="m-auto flex max-w-xs flex-col items-center gap-2 text-center text-sm text-muted-foreground">
              <Sparkles className="size-6 text-brand-accent" />
              {t("chatEmpty")}
            </div>
          )}
          {turns.map((turn) => (
            <div key={turn.id} className="flex flex-col gap-2">
              <p className="ms-auto max-w-[85%] rounded-2xl rounded-se-sm bg-primary px-3 py-2 text-sm text-primary-foreground">{turn.question}</p>
              <AssistantReply turn={turn} onSettled={() => setBusy(false)} />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 border-t px-3 pt-2.5">
          {STARTERS.map((scenario) => (
            <button
              key={scenario}
              type="button"
              disabled={busy}
              onClick={() => ask(t(`chat.${scenario}.question`), scenario)}
              className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
            >
              {t(`chat.${scenario}.question`)}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-center gap-2 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={200}
            placeholder={t("chatPlaceholder")}
            aria-label={t("chatPlaceholder")}
            className="h-9 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label={t("chatSend")}
            className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-[opacity,scale] hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            <Send className="size-4 rtl:-scale-x-100" />
          </button>
        </form>
      </div>
      <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">{t("chatFooter")}</p>
    </DemoCard>
  );
}

// ─── Section ────────────────────────────────────────────────────────────

const PROMISES = [
  { key: "promiseConfirm", icon: ShieldCheck },
  { key: "promiseData", icon: Database },
  { key: "promiseLanguages", icon: Languages },
] as const;

export function AiShowcase() {
  const t = useTranslations("AiShowcase");
  const demos = useStaggerIn<HTMLDivElement>({ selector: "[data-animate='demo']", scroll: true });
  const promises = useFadeIn<HTMLUListElement>({ y: 16, scroll: true });

  return (
    <section id="ai" className="relative isolate scroll-mt-20 overflow-hidden border-y bg-muted/30">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute -top-32 end-1/4 h-80 w-[36rem] rounded-full bg-brand-accent/15 blur-3xl" />
        <div className="absolute -bottom-32 start-1/4 h-80 w-[36rem] rounded-full bg-primary/10 blur-3xl" />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-20 lg:py-28">
        <SectionHeading eyebrow={t("eyebrow")} heading={t("heading")} subtext={t("subtext")} center />

        <div ref={demos} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DraftDemo />
          <AssistantDemo />
        </div>

        <ul ref={promises} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PROMISES.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-start gap-3 rounded-xl border bg-card/70 p-4">
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{t(`${key}Title`)}</span>
                <span className="text-sm text-muted-foreground">{t(`${key}Body`)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
