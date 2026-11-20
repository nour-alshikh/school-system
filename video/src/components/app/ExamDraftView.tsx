import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { useTranslations } from "next-intl";
import { Loader2, Mic, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "../../config";
import { popIn, progress } from "../../lib/motion";
import type { DraftQuestion } from "../../mock";
import { FieldFill } from "../FieldFill";
import { Press } from "../Ripple";
import { SuccessChip } from "../SuccessChip";
import { typedLength } from "../Typing";
import { SelectBox } from "./SelectBox";

export interface ExamDraftData {
  title: string;
  subject: string;
  grade: string;
  duration: string;
  notes: string;
  questions: DraftQuestion[];
}

/** Scene-local frames for each step of the flow. */
export interface ExamDraftTimes {
  scrollToQuestions: number;
  openPopover: number;
  typeNotes: number;
  draft: number;
  fill: number;
  questionGap: number;
  review: number;
}

/** FormItem (grid gap-1.5) + the real Label, as the form renders them. */
function Item({ label, children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div data-slot="form-item" className={`grid gap-1.5 ${className ?? ""}`}>
      {label && <Label>{label}</Label>}
      {children}
    </div>
  );
}

/** Frame at which question `q`'s field `k` starts filling (k: 0 text, 1 marks, 2.. options). */
function fieldAt(times: ExamDraftTimes, q: number, k: number) {
  return times.fill + q * times.questionGap + k * motion.fieldGap;
}

/**
 * The exam builder (features/exams/exam-form.tsx), rebuilt with its markup,
 * real ui components and real strings, driven by the frame: the form is
 * already titled; the view scrolls to Questions, "Draft with AI" opens its
 * popover, notes are typed, Draft is pressed, and the drafted questions
 * replace the empty one, field by field, each with the amber AI ring.
 * `viewport` is the visible height in CSS px, for the scroll targets.
 */
export function ExamDraftView({ data, times, viewport, reviewLabel }: { data: ExamDraftData; times: ExamDraftTimes; viewport: number; reviewLabel: string }) {
  const frame = useCurrentFrame();
  const t = useTranslations("ExamFormPage");
  const tAi = useTranslations("AiDraft");

  // Measured once (positions don't change with the frame): where Questions,
  // each question and the buttons sit inside the form.
  const root = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState<{ questions: number; items: number[]; end: number } | null>(null);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const top = (sel: string) => (el.querySelector(sel) as HTMLElement | null)?.offsetTop ?? 0;
    setMarks({
      questions: top("[data-mark=questions]"),
      items: Array.from(el.querySelectorAll<HTMLElement>("[data-mark=question]")).map((q) => q.offsetTop),
      end: top("[data-mark=end]"),
    });
  }, []);

  const drafted = frame >= times.fill;
  const draftDone = times.fill - 2;
  const popoverOpen = frame >= times.openPopover && frame < draftDone;
  const pending = frame >= times.draft + motion.press && frame < draftDone;

  // Scroll: top → Questions → follow each drafted question → the buttons.
  const keys: [number, number][] = [[0, 0]];
  if (marks) {
    keys.push([times.scrollToQuestions, marks.questions - 20]);
    data.questions.forEach((_, i) => keys.push([fieldAt(times, i, 0), (marks.items[i] ?? marks.questions) + 56]));
    keys.push([times.review, Math.max(0, marks.end - viewport + 76)]);
  }
  let scroll = 0;
  for (let i = 1; i < keys.length; i++) {
    const [f, y] = keys[i]!;
    if (frame < f) break;
    const prev = keys[i - 1]![1];
    scroll = prev + (y - prev) * progress(frame, f, 20, Easing.inOut(Easing.cubic));
  }

  const questions: (DraftQuestion | null)[] = drafted ? data.questions : [null];
  const notesShown = data.notes.slice(0, typedLength(frame, times.typeNotes, data.notes, 30));

  return (
    <div style={{ transform: `translateY(${-scroll}px)` }}>
      <div ref={root} className="relative flex flex-col gap-6 p-6">
        <h2 className="text-lg font-semibold">{t("createHeading")}</h2>
        <Item label={t("titleLabel")}>
          <Input readOnly value={data.title} className="h-10" />
        </Item>
        <Item label={t("typeLabel")}>
          <SelectBox value="exam" label={t("kind.exam")} className="w-full" />
        </Item>
        <Item label={t("subjectLabel")}>
          <SelectBox value="science" label={data.subject} className="w-full" />
        </Item>
        <Item label={t("gradeLabel")}>
          <SelectBox value="grade-8" label={data.grade} className="w-full" />
        </Item>
        <Item label={t("instructionsLabel")}>
          <Textarea readOnly rows={3} value="" />
        </Item>
        <div className="flex flex-wrap gap-4">
          <Item label={t("durationLabel")} className="w-40">
            <Input readOnly value={data.duration} className="h-10" />
          </Item>
          <Item label={t("opensAtLabel")}>
            <Input readOnly type="datetime-local" value="2026-11-26T10:00" className="h-10" />
          </Item>
        </div>
        <Item label={t("statusLabel")}>
          <SelectBox value="draft" label={t("status.draft")} className="w-full" />
        </Item>

        <div className="flex flex-col gap-4">
          <div data-mark="questions" className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{t("questionsHeading")}</h3>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Press at={times.openPopover - 6} radius={12} rippleColor="rgba(15,118,110,.18)">
                <Button type="button" variant="outline" size="sm" aria-expanded={popoverOpen}>
                  <Sparkles className="size-4 text-brand-accent-strong" />
                  {tAi("trigger")}
                </Button>
              </Press>
              <Button type="button" variant="outline" size="sm">
                <Plus className="size-4" />
                {t("addQuestion")}
              </Button>
            </div>
          </div>

          {questions.map((q, i) => (
            <QuestionCard key={i} index={i} question={q} times={times} />
          ))}
        </div>

        <div data-mark="end" className="flex flex-wrap items-center gap-2">
          <Button type="button" style={frame >= times.review ? popIn(frame, times.review) : undefined}>
            {t("createExam")}
          </Button>
          <Button type="button" variant="outline">
            {t("cancel")}
          </Button>
          <span className="ms-2">
            <SuccessChip at={times.review + 8}>{reviewLabel}</SuccessChip>
          </span>
        </div>

        {/* The "Draft with AI" popover (ai-draft-button.tsx), anchored under its button, end-aligned. */}
        {popoverOpen && marks && (
          <div
            className="absolute z-50 flex w-80 flex-col gap-2 rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10"
            style={{ top: marks.questions + 44, insetInlineEnd: 24, ...popIn(frame, times.openPopover), transformOrigin: "top right" }}
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-brand-accent-strong" />
              {tAi("trigger")}
            </p>
            <p className="text-xs text-muted-foreground">{t("aiHint")}</p>
            <Textarea readOnly rows={4} value={notesShown} placeholder={t("aiPlaceholder")} />
            <div className="flex items-center justify-end gap-2">
              <Button type="button" size="sm" variant="ghost">
                <Mic className="size-4" />
                {tAi("micStart")}
              </Button>
              <Press at={times.draft} radius={12}>
                <Button type="button" size="sm" disabled={pending} style={pending ? { opacity: 1 } : undefined}>
                  {pending ? (
                    <Loader2 className="size-4" style={{ transform: `rotate(${(frame * 18) % 360}deg)` }} />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {pending ? tAi("drafting") : tAi("draft")}
                </Button>
              </Press>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** QuestionCard from exam-form.tsx: empty (the form's default) or a drafted question filling in. */
function QuestionCard({ index, question, times }: { index: number; question: DraftQuestion | null; times: ExamDraftTimes }) {
  const frame = useCurrentFrame();
  const t = useTranslations("ExamFormPage");
  const options = question?.options ?? ["", ""];
  const correctAt = fieldAt(times, index, 2 + options.length);
  const selected = question && frame >= correctAt ? String(question.correct) : "";
  const enter = question ? interpolate(frame, [fieldAt(times, index, 0) - 8, fieldAt(times, index, 0)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;

  const fill = (k: number, value: string, render: (shown: string) => ReactNode, typeFrames = 8) =>
    question ? (
      <FieldFill value={value} at={fieldAt(times, index, k)} typeFrames={typeFrames}>
        {render}
      </FieldFill>
    ) : (
      render("")
    );

  return (
    <div data-mark="question" className="flex flex-col gap-4 rounded-lg border p-4" style={{ opacity: enter }}>
      <div className="flex items-start justify-between gap-2">
        <span className="pt-2 text-sm font-medium text-muted-foreground">{t("questionNumber", { number: index + 1 })}</span>
        <Button type="button" variant="ghost" size="icon" disabled>
          <Trash2 className="size-4" />
        </Button>
      </div>
      <Item label={t("questionTextLabel")}>{fill(0, question?.text ?? "", (s) => <Textarea readOnly rows={2} value={s} />, 12)}</Item>
      <Item label={t("marksLabel")} className="w-32">
        {fill(1, question?.marks ?? "1", (s) => <Input readOnly type="text" value={question ? s : "1"} className="h-10" />, 2)}
      </Item>
      <Item label={t("optionsLabel")}>
        <RadioGroup value={selected} className="flex flex-col gap-2">
          {options.map((option, j) => (
            <div key={j} className="flex items-center gap-2">
              <RadioGroupItem value={String(j)} />
              <div className="flex-1">
                {fill(2 + j, option, (s) => <Input readOnly value={s} placeholder={t("optionPlaceholder", { number: j + 1 })} className="h-10" />, 6)}
              </div>
              <Button type="button" variant="ghost" size="icon" disabled={options.length <= 2}>
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </RadioGroup>
        <Button type="button" variant="outline" size="sm" className="w-fit">
          <Plus className="size-4" />
          {t("addOption")}
        </Button>
      </Item>
    </div>
  );
}
