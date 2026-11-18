"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Language = "en" | "ar";

/**
 * ✦ Progress note (docs/ai-assistant-plan.md, phase 7): the AI writes a
 * short note to the parents from the student's last 30 days of attendance
 * and recent results, plus anything the user adds. Nothing is saved or
 * sent — the user edits it here and copies it. Shown only when the school
 * lets AI read its data (user.ai_reads_data), since the records go to the
 * AI provider.
 */
export function ProgressNoteButton({ studentId }: { studentId: number }) {
  const t = useTranslations("ProgressNote");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<Language>(locale === "ar" ? "ar" : "en");
  const [notes, setNotes] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const draft = useMutation({
    mutationFn: () =>
      apiFetch<{ draft: { note: string } }>("/api/ai/draft/progress_note", {
        method: "POST",
        body: JSON.stringify({
          notes: notes.trim() || null,
          context: { student_id: studentId, language },
        }),
      }).then((d) => d.draft.note),
    onSuccess: setNote,
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : tErrors("somethingWentWrong")),
  });

  if (!user?.ai_available || !user.ai_reads_data) return null;

  async function copy() {
    if (!note) return;
    try {
      await navigator.clipboard.writeText(note);
      toast.success(t("copied"));
    } catch {
      toast.error(tErrors("somethingWentWrong"));
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="size-4 text-brand-accent-strong dark:text-brand-accent" />
        {t("trigger")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand-accent-strong dark:text-brand-accent" />
              {t("title")}
            </DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t("languageLabel")}</Label>
              <div role="radiogroup" className="inline-flex w-fit rounded-lg border p-0.5">
                {(["en", "ar"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    role="radio"
                    aria-checked={language === lang}
                    onClick={() => setLanguage(lang)}
                    className={cn(
                      "rounded-md px-3 py-1 text-sm transition-colors",
                      language === lang
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {lang === "en" ? t("english") : t("arabic")}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="progress-note-notes">{t("notesLabel")}</Label>
              <Textarea
                id="progress-note-notes"
                rows={3}
                maxLength={2000}
                placeholder={t("notesPlaceholder")}
                value={notes}
                disabled={draft.isPending}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Button
              type="button"
              className="self-start"
              disabled={draft.isPending}
              onClick={() => draft.mutate()}
            >
              {draft.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {draft.isPending ? t("writing") : note ? t("rewrite") : t("write")}
            </Button>

            {note !== null && (
              <div className="flex flex-col gap-2 border-t pt-4">
                <Label htmlFor="progress-note-text">{t("noteLabel")}</Label>
                <Textarea
                  id="progress-note-text"
                  rows={10}
                  dir={language === "ar" ? "rtl" : "ltr"}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t("reviewHint")}</p>
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => void copy()}>
                  <Copy className="size-4" />
                  {t("copy")}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
