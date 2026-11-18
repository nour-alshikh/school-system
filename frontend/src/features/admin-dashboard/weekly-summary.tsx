"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useMoney } from "@/hooks/use-money";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Panel } from "./charts";
import { formatNumber, formatPercent, intlLocale } from "./utils";

/** GET/POST /api/admin/weekly-summary (WeeklySummary::facts). */
type WeeklyFacts = {
  from: string;
  to: string;
  attendance: {
    records: number;
    rate_percent: number | null;
    previous_week_rate_percent: number | null;
  };
  unmarked_days: { date: string; is_today: boolean; unmarked_count: number }[];
  new_students: number;
  payments?: { count: number; total: string };
  exams_next_7_days?: number;
};

type WeeklySummaryResponse = {
  facts: WeeklyFacts;
  summary: { text: string; generated_at: string } | null;
  can_write: boolean;
};

/**
 * "This week" (docs/ai-assistant-plan.md, phase 7): the last 7 days in
 * numbers, always; and a few sentences the AI writes from those numbers
 * when the school lets it read its data. The written summary is kept for
 * the day on the server, so Rewrite is the only thing that calls the AI.
 */
export function WeeklySummary({ className }: { className?: string }) {
  const t = useTranslations("WeeklySummary");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const money = useMoney();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["weekly-summary", locale];

  const { data } = useQuery({
    queryKey,
    queryFn: () => apiFetch<WeeklySummaryResponse>("/api/admin/weekly-summary"),
  });

  const write = useMutation({
    mutationFn: () => apiFetch<WeeklySummaryResponse>("/api/admin/weekly-summary", { method: "POST" }),
    onSuccess: (next) => queryClient.setQueryData(queryKey, next),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : tErrors("somethingWentWrong")),
  });

  if (!data) return null;

  const { facts, summary } = data;
  const aiOn = !!user?.ai_available;
  const weekday = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long" });
  const rate = facts.attendance.rate_percent;
  const previous = facts.attendance.previous_week_rate_percent;
  const unmarked = facts.unmarked_days.filter((d) => !d.is_today);

  const rows: { label: string; value: string }[] = [
    {
      label: t("attendance"),
      value:
        rate === null
          ? t("noAttendance")
          : previous === null
            ? formatPercent(rate, locale)
            : t("attendanceVs", {
                rate: formatPercent(rate, locale),
                previous: formatPercent(previous, locale),
              }),
    },
    {
      label: t("unmarked"),
      value: unmarked.length
        ? unmarked
            .map((d) => t("unmarkedDay", { day: weekday.format(new Date(`${d.date}T12:00:00`)), count: d.unmarked_count }))
            .join(locale === "ar" ? "، " : ", ")
        : t("allMarked"),
    },
    ...(facts.payments
      ? [{ label: t("payments"), value: t("paymentsValue", { count: facts.payments.count, total: money(facts.payments.total) }) }]
      : []),
    { label: t("newStudents"), value: formatNumber(facts.new_students, locale) },
    ...(facts.exams_next_7_days !== undefined
      ? [{ label: t("examsNext"), value: formatNumber(facts.exams_next_7_days, locale) }]
      : []),
  ];

  return (
    <Panel
      className={className}
      title={t("title")}
      description={t("range")}
      action={
        aiOn && data.can_write ? (
          <Button type="button" size="sm" variant="outline" disabled={write.isPending} onClick={() => write.mutate()}>
            {write.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : summary ? (
              <RefreshCw className="size-4" />
            ) : (
              <Sparkles className="size-4 text-brand-accent-strong dark:text-brand-accent" />
            )}
            {summary ? t("rewrite") : t("write")}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {summary && (
          <div className="rounded-lg border border-brand-accent/30 bg-brand-accent/5 p-3">
            <p className="text-sm leading-relaxed">{summary.text}</p>
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="size-3" />
              {t("writtenAt", {
                time: new Intl.DateTimeFormat(intlLocale(locale), { timeStyle: "short" }).format(new Date(summary.generated_at)),
              })}
            </p>
          </div>
        )}
        {aiOn && !data.can_write && (
          <p className="text-xs text-muted-foreground">
            {t.rich("enableHint", {
              link: (chunks) => (
                <Link href="/admin/settings" className="underline underline-offset-4 hover:text-foreground">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        )}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-sm font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  );
}
