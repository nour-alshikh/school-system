"use client";

import { cn } from "@/lib/utils";
import { AiTranslateButton } from "@/components/ai/ai-translate-button";

const LOCALE_CODE = { en: "EN", ar: "AR" } as const;

// Small pill toggle for switching which locale's input is visible on a
// bilingual field (see docs/forms.md#translatable-fields-locale-tabs) —
// reused across any form with a translatable name/label pair. Rendered next
// to that locale's own FormLabel in a `justify-between` row, directly above
// its input. Shows a fixed EN/AR code rather than the field's own label —
// too long for a pill, and the adjacent FormLabel already carries it.
//
// With `translate` (the pair's form field names), a ✦ Translate button
// appears beside the pills when the shown language is empty and the other
// isn't — see AiTranslateButton. Needs the form's <Form> provider.
export function LocaleTabs({
  value,
  onChange,
  errors,
  translate,
}: {
  value: "en" | "ar";
  onChange: (locale: "en" | "ar") => void;
  errors?: { en?: boolean; ar?: boolean };
  translate?: { en: string; ar: string; what?: string };
}) {
  const tabs = (
    <div className="inline-flex w-fit shrink-0 gap-1 rounded-md border p-0.5">
      {(["en", "ar"] as const).map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => onChange(locale)}
          className={cn(
            "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
            value === locale
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {LOCALE_CODE[locale]}
          {errors?.[locale] && <span className="text-destructive"> *</span>}
        </button>
      ))}
    </div>
  );

  if (!translate) return tabs;

  return (
    <div className="flex items-center gap-1">
      <AiTranslateButton en={translate.en} ar={translate.ar} what={translate.what} active={value} />
      {tabs}
    </div>
  );
}
