"use client";

import { useLocale, useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { PlatformAiUsage } from "./types";

/**
 * AI calls across schools (docs/ai-assistant-plan.md, rule 7): today, the
 * last 30 days, failures and tokens, and the schools using it most — so
 * cost can be watched. Counts only; what was asked is never stored.
 */
export function AiUsageCard({ usage }: { usage?: PlatformAiUsage }) {
  const t = useTranslations("Platform.overview");
  const locale = useLocale();
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  const failureRate = usage && usage.calls_30d > 0 ? Math.round((usage.failed_30d / usage.calls_30d) * 100) : 0;

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-brand-accent-strong dark:text-brand-accent" />
        {t("aiUsage")}
      </h2>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("aiCallsToday"), value: usage && number(usage.calls_today) },
          { label: t("aiCalls30d"), value: usage && number(usage.calls_30d) },
          { label: t("aiFailed30d"), value: usage && `${number(usage.failed_30d)} (${failureRate}%)` },
          { label: t("aiTokens30d"), value: usage && number(usage.tokens_30d) },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {stat.value ?? <span className="block h-7 w-16 animate-pulse rounded bg-muted" />}
            </dd>
          </div>
        ))}
      </dl>

      {usage && usage.by_school.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-medium text-muted-foreground">{t("aiTopSchools")}</h3>
          <ul className="divide-y text-sm">
            {usage.by_school.map((row) => (
              <li key={row.school_id} className="flex items-center justify-between gap-3 py-1.5">
                <Link href={`/platform/schools/${row.school_id}`} className="truncate hover:underline">
                  {row.name ?? `#${row.school_id}`}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {t("aiSchoolRow", { calls: number(row.calls), failed: number(row.failed), tokens: number(row.tokens) })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {usage && usage.calls_30d === 0 && <p className="text-xs text-muted-foreground">{t("aiNone")}</p>}
    </section>
  );
}
