"use client";

import { useTranslations } from "next-intl";
import { useFormContext, useWatch } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { useAiAvailable } from "@/hooks/use-ai-draft";
import { apiFetch, ApiError } from "@/lib/api";

/**
 * ✦ Translate (docs/ai-assistant-plan.md, phase 3): on a bilingual field,
 * shown on the language tab that's empty while the other has text. Fills it
 * with a natural translation for the user to check — nothing is saved.
 * Needs the form's FormProvider (shadcn's <Form>), so it works from inside
 * LocaleTabs without each form wiring it up.
 */
export function AiTranslateButton({
  en,
  ar,
  active,
  what,
}: {
  /** Form field names of the English and Arabic values. */
  en: string;
  ar: string;
  /** The tab being shown: that's the language to fill. */
  active: "en" | "ar";
  /** What the text is ("stage name"), so terms come out right. */
  what?: string;
}) {
  const t = useTranslations("AiDraft");
  const tErrors = useTranslations("Errors");
  const available = useAiAvailable();
  const form = useFormContext();
  const [enValue, arValue] = useWatch({ control: form.control, name: [en, ar] }) as [string | undefined, string | undefined];

  const target = active === "en" ? en : ar;
  const from = active === "en" ? "ar" : "en";
  const source = (from === "en" ? enValue : arValue)?.trim() ?? "";
  const empty = !(active === "en" ? enValue : arValue)?.trim();

  const translate = useMutation({
    mutationFn: () =>
      apiFetch<{ draft: { text: string } }>("/api/ai/draft/translate", {
        method: "POST",
        body: JSON.stringify({ notes: source, context: { from, what } }),
      }).then((d) => d.draft.text),
    onSuccess: (text) => form.setValue(target, text, { shouldDirty: true, shouldValidate: true }),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : tErrors("somethingWentWrong")),
  });

  if (!available || !empty || !source) return null;

  const label = from === "en" ? t("translateFromEn") : t("translateFromAr");

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={translate.isPending}
      onClick={() => translate.mutate()}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-brand-accent-strong transition-colors hover:bg-brand-accent/10 disabled:opacity-60 dark:text-brand-accent"
    >
      {translate.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
      {t("translate")}
    </button>
  );
}
