"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money";
import { monthLabel } from "./format";

/**
 * Fee collections per month, one school, one series: bars in the theme's
 * primary colour (one colour for one series; the title names it, so no
 * legend box). Thin bars with a 2px gap, rounded ends on the baseline,
 * a recessive grid, a hover tooltip per bar, and a table view.
 */
export function CollectionsChart({
  months,
  currency,
}: {
  months: { month: string; amount: string }[];
  currency: string | null;
}) {
  const t = useTranslations("Platform.detail");
  const locale = useLocale();
  const [asTable, setAsTable] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  const values = months.map((m) => Number(m.amount));
  const max = Math.max(...values, 0);
  // A round top for the grid: 1, 2 or 5 × a power of ten.
  const top = niceCeiling(max);
  const ticks = top > 0 ? [top, top / 2, 0] : [0];
  const money = (n: number) => formatMoney(n, currency, locale);
  const last = months.length - 1;

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <figcaption className="text-sm font-semibold">{t("collectionsHeading")}</figcaption>
        <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setAsTable((v) => !v)}>
          {asTable ? t("showChart") : t("showTable")}
        </button>
      </div>

      {asTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-start text-xs text-muted-foreground">
              <th className="py-1 text-start font-medium">{t("month")}</th>
              <th className="py-1 text-end font-medium">{t("collected")}</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className="border-b last:border-0">
                <td className="py-1">{monthLabel(m.month, locale)}</td>
                <td className="py-1 text-end tabular-nums">{money(Number(m.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex gap-2">
          {/* Y axis: recessive, three ticks. */}
          <div className="relative w-20 shrink-0 text-end text-[11px] text-muted-foreground" aria-hidden>
            {ticks.map((tick, i) => (
              <span key={i} className="absolute end-0 -translate-y-1/2 tabular-nums" style={{ top: `${(i / Math.max(ticks.length - 1, 1)) * 100}%` }}>
                {money(tick)}
              </span>
            ))}
          </div>

          <div className="flex flex-1 flex-col gap-1">
            <div className="relative h-44">
              {ticks.map((_, i) => (
                <div key={i} className="absolute inset-x-0 border-t border-border/60" style={{ top: `${(i / Math.max(ticks.length - 1, 1)) * 100}%` }} />
              ))}
              <div className="absolute inset-0 flex items-end gap-[2px]" role="list" aria-label={t("collectionsHeading")}>
                {months.map((m, i) => {
                  const value = values[i];
                  const height = top > 0 ? (value / top) * 100 : 0;
                  return (
                    <div
                      key={m.month}
                      role="listitem"
                      aria-label={`${monthLabel(m.month, locale)}: ${money(value)}`}
                      tabIndex={0}
                      // The hit target is the whole column, not just the bar.
                      className="relative flex h-full flex-1 items-end justify-center outline-none"
                      onMouseEnter={() => setHovered(i)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(i)}
                      onBlur={() => setHovered(null)}
                    >
                      <div
                        className={`w-full max-w-10 rounded-t-[4px] bg-primary transition-opacity ${hovered !== null && hovered !== i ? "opacity-50" : ""}`}
                        style={{ height: `${height}%`, minHeight: value > 0 ? 2 : 0 }}
                      />
                      {/* Selective direct label: the latest month only. */}
                      {i === last && hovered === null && value > 0 && (
                        <span className="absolute -translate-y-full pb-1 text-[11px] font-medium tabular-nums" style={{ bottom: `${height}%` }}>
                          {money(value)}
                        </span>
                      )}
                      {hovered === i && (
                        <div
                          className="pointer-events-none absolute z-10 -translate-y-full whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-sm"
                          style={{ bottom: `${height}%` }}
                        >
                          <div className="text-muted-foreground">{monthLabel(m.month, locale)}</div>
                          <div className="font-medium tabular-nums">{money(value)}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-[2px] text-[11px] text-muted-foreground" aria-hidden>
              {months.map((m) => (
                <span key={m.month} className="flex-1 truncate text-center">
                  {monthLabel(m.month, locale)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}

function niceCeiling(value: number): number {
  if (value <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((s) => s * power >= value) ?? 10;
  return step * power;
}
