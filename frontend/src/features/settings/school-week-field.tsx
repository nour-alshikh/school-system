"use client";

import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";

// 2026-01-04 was a Sunday: index i is weekday i (0 = Sunday … 6 = Saturday),
// matching the API's school_days and Carbon's dayOfWeek.
const SUNDAY = new Date(2026, 0, 4);

function weekdayName(day: number, locale: string): string {
  const date = new Date(SUNDAY);
  date.setDate(SUNDAY.getDate() + day);
  return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
}

/**
 * Seven toggles for the school week. The value is the API's form: the
 * chosen weekday numbers, comma-separated and sorted ("0,1,2,3,4"), or ""
 * when none is chosen.
 */
export function SchoolWeekField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const locale = useLocale();
  const chosen = new Set(
    value ? value.split(",").map((day) => Number(day)) : []
  );

  function toggle(day: number) {
    const next = new Set(chosen);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange([...next].sort((a, b) => a - b).join(","));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {[0, 1, 2, 3, 4, 5, 6].map((day) => {
        const on = chosen.has(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(day)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              on
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {weekdayName(day, locale)}
          </button>
        );
      })}
    </div>
  );
}
