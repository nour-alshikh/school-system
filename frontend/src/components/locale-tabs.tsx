"use client";

import { cn } from "@/lib/utils";

// Small pill toggle for switching which locale's input is visible on a
// bilingual field (see docs/forms.md#translatable-fields-locale-tabs) —
// reused across any form with a translatable name/label pair.
export function LocaleTabs({
  value,
  onChange,
  labels,
  errors,
}: {
  value: "en" | "ar";
  onChange: (locale: "en" | "ar") => void;
  labels: { en: string; ar: string };
  errors?: { en?: boolean; ar?: boolean };
}) {
  return (
    <div className="inline-flex w-fit gap-1 self-start rounded-md border p-0.5">
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
          {labels[locale]}
          {errors?.[locale] && <span className="text-destructive"> *</span>}
        </button>
      ))}
    </div>
  );
}
