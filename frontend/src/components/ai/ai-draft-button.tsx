"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Mic, MicOff, Sparkles, Undo2 } from "lucide-react";
import { useAiAvailable, type AiDraftController } from "@/hooks/use-ai-draft";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

const MAX_NOTES = 2000;

/**
 * "✦ Draft with AI" (docs/ai-assistant-plan.md, phase 1): a popover where
 * the user types or dictates rough notes, then the draft fills the form
 * through `ai` (useAiDraft). Shows "Undo AI draft" after a draft. Hidden
 * when AI isn't available to this user, unless `available` says otherwise
 * (the system admin, who has no school).
 */
export function AiDraftButton({
  ai,
  placeholder,
  hint,
  available,
  className,
  initialNotes,
  defaultOpen,
}: {
  ai: AiDraftController;
  /** Example notes for this form. */
  placeholder?: string;
  /** What the AI fills in, for this form. */
  hint?: string;
  available?: boolean;
  className?: string;
  /** Notes to start with, e.g. a request handed over by the assistant. */
  initialNotes?: string;
  /** Opens the popover on mount (with initialNotes, ready to draft). */
  defaultOpen?: boolean;
}) {
  const t = useTranslations("AiDraft");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const aiAvailable = useAiAvailable();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [notes, setNotes] = useState(initialNotes?.slice(0, MAX_NOTES) ?? "");

  // Dictated phrases are appended to the notes, in the UI's language.
  const speech = useSpeechRecognition({
    lang: locale === "ar" ? "ar-SA" : "en-US",
    onText: (text) => setNotes((n) => (n.trim() ? `${n.trimEnd()} ${text}` : text).slice(0, MAX_NOTES)),
    onError: (error) => toast.error(error === "not-allowed" || error === "service-not-allowed" ? t("micBlocked") : t("micFailed")),
  });

  if (!(available ?? aiAvailable)) return null;

  async function run() {
    speech.stop();
    try {
      await ai.draft(notes);
      toast.success(t("drafted"));
      setOpen(false);
      setNotes("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tErrors("somethingWentWrong"));
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {ai.canUndo && (
        <button
          type="button"
          onClick={() => {
            ai.undo();
            toast.success(t("undone"));
          }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <Undo2 className="size-3.5" />
          {t("undo")}
        </button>
      )}
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (!next) speech.stop();
          setOpen(next);
        }}
      >
        <PopoverTrigger className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Sparkles className="size-4 text-brand-accent-strong dark:text-brand-accent" />
          {t("trigger")}
        </PopoverTrigger>
        <PopoverContent className="flex flex-col gap-2">
          <PopoverTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand-accent-strong dark:text-brand-accent" />
            {t("trigger")}
          </PopoverTitle>
          <PopoverDescription>{hint ?? t("hint")}</PopoverDescription>
          <Textarea
            rows={4}
            maxLength={MAX_NOTES}
            placeholder={placeholder ?? t("placeholder")}
            value={notes}
            disabled={ai.isPending}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl/⌘ + Enter drafts, like sending a message.
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && notes.trim() && !ai.isPending) {
                e.preventDefault();
                void run();
              }
            }}
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            {speech.supported && (
              <Button
                type="button"
                size="sm"
                variant={speech.listening ? "destructive" : "ghost"}
                aria-pressed={speech.listening}
                disabled={ai.isPending}
                onClick={speech.listening ? speech.stop : speech.start}
              >
                {speech.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                {speech.listening ? t("micStop") : t("micStart")}
              </Button>
            )}
            <Button type="button" size="sm" disabled={!notes.trim() || ai.isPending} onClick={() => void run()}>
              {ai.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {ai.isPending ? t("drafting") : t("draft")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
