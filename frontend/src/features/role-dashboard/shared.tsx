"use client";

import type { ComponentType, ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { CalendarDays, ClipboardList, Video } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { DashboardAgendaItemType } from "@/types/generated";
import { EmptyState, Panel } from "@/features/admin-dashboard/charts";
import { formatNumber, formatPercent, greetingKey, intlLocale } from "@/features/admin-dashboard/utils";

/** Amber pill for the facts beside the date (year, grade, child). */
export const headerBadgeClass = "bg-brand-accent/15 text-brand-accent-strong ring-1 ring-brand-accent/30";

/** Greeting, today's date, a few badges and the role's quick actions. */
export function DashboardHeader({
  title,
  badges,
  actions,
}: {
  title: string;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "full" }).format(new Date())}
          {badges}
        </p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** "Good morning, Mona" for the current hour. */
export function useGreeting(name: string) {
  const t = useTranslations("RoleDashboards");
  return t(greetingKey(), { name: name.split(" ")[0] });
}

const KIND_STYLES: Record<DashboardAgendaItemType["kind"], { icon: ComponentType<{ className?: string }>; className: string }> = {
  meeting: { icon: Video, className: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  exam: { icon: ClipboardList, className: "bg-brand-accent/15 text-amber-700 dark:text-amber-300" },
  event: { icon: CalendarDays, className: "bg-primary/10 text-primary dark:text-teal-300" },
};

/** Y-m-d of a date in the browser's time zone. */
function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function itemDay(item: DashboardAgendaItemType) {
  return item.all_day ? item.starts_at : localDay(new Date(item.starts_at));
}

/**
 * The "Coming up" list: online lessons, exams that close and school events,
 * grouped by day. There's no timetable, so this is the schedule.
 */
export function AgendaPanel({
  items,
  hrefFor,
  title,
  className,
}: {
  items: DashboardAgendaItemType[];
  /** Where a row links to, by kind; none means not a link. */
  hrefFor: (item: DashboardAgendaItemType) => string | undefined;
  title?: string;
  className?: string;
}) {
  const t = useTranslations("RoleDashboards");
  const locale = useLocale();
  const now = new Date();
  const today = localDay(now);
  const tomorrow = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));

  const dayLabel = (day: string) => {
    if (day === today) return t("today");
    if (day === tomorrow) return t("tomorrow");
    const [y, m, d] = day.split("-").map(Number);
    return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", month: "short", day: "numeric" }).format(new Date(y, m - 1, d));
  };
  const time = (iso: string) => new Intl.DateTimeFormat(intlLocale(locale), { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  const kindLabel = { meeting: t("kindMeeting"), exam: t("kindExam"), event: t("kindEvent") };

  const days = [...new Set(items.map(itemDay))];

  return (
    <Panel
      className={className}
      title={title ?? t("comingUp")}
      action={
        <Button variant="ghost" size="sm" nativeButton={false} render={<a href="#calendar" />}>
          {t("viewCalendar")}
        </Button>
      }
    >
      {items.length === 0 ? (
        <EmptyState>{t("comingUpEmpty")}</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {days.map((day) => (
            <div key={day} className="flex flex-col gap-2">
              <h3 className={cn("text-xs font-semibold", day === today ? "text-primary dark:text-teal-300" : "text-muted-foreground")}>
                {dayLabel(day)}
              </h3>
              <ul className="flex flex-col gap-2">
                {items
                  .filter((item) => itemDay(item) === day)
                  .map((item) => {
                    const { icon: Icon, className: tone } = KIND_STYLES[item.kind];
                    const subject = locale === "ar" ? item.subject_name_ar : item.subject_name_en;
                    const href = hrefFor(item);
                    const row = (
                      <>
                        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone)}>
                          <Icon className="size-4" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium">{item.title}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {kindLabel[item.kind]}
                            {subject && ` · ${subject}`}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {item.all_day ? t("allDay") : time(item.starts_at)}
                        </span>
                      </>
                    );
                    return (
                      <li key={`${item.kind}-${item.id}`}>
                        {href ? (
                          <Link href={href} className="flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-muted/50">
                            {row}
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3 rounded-lg border p-2.5">{row}</div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** A ring showing a 0–100 rate, with the number in the middle. */
export function RateRing({ rate, label, size = 132 }: { rate: number | null; label: string; size?: number }) {
  const locale = useLocale();
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const value = rate ?? 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        {rate !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums">{rate === null ? "—" : formatPercent(value, locale, 0)}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

/** Present (or late) days as a share of all recorded days; null with none. */
export function attendanceRateOf(summary: { present: number; late: number; total: number }): number | null {
  return summary.total > 0 ? ((summary.present + summary.late) / summary.total) * 100 : null;
}

export interface ScorePoint {
  key: string;
  /** Short x-axis label. */
  label: string;
  /** 0–100, or null for no data. */
  value: number | null;
  title: string;
  rows: { label: string; value: string }[];
}

const scoreConfig = { value: { label: "score", color: "var(--chart-1)" } } satisfies ChartConfig;

/** Scores over time: an area for one student's results, bars for class averages. */
export function ScoreChart({ points, variant }: { points: ScorePoint[]; variant: "area" | "bar" }) {
  const locale = useLocale();
  const rtl = locale === "ar";

  const axes = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="label" reversed={rtl} tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
      <YAxis
        orientation={rtl ? "right" : "left"}
        domain={[0, 100]}
        ticks={[0, 25, 50, 75, 100]}
        width={48}
        tickLine={false}
        axisLine={false}
        tickFormatter={(v: number) => formatPercent(v, locale, 0)}
      />
      <ChartTooltip
        cursor={variant === "area" ? { strokeWidth: 1 } : { fill: "var(--muted)", opacity: 0.5 }}
        content={({ active, payload }) => {
          const point = active ? (payload?.[0]?.payload as ScorePoint | undefined) : undefined;
          if (!point) return null;
          return (
            <div className="grid min-w-40 gap-1.5 rounded-lg border bg-background px-2.5 py-2 text-xs shadow-xl">
              <p className="font-medium">{point.title}</p>
              {point.rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-mono font-medium tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
          );
        }}
      />
    </>
  );

  return (
    <ChartContainer config={scoreConfig} className="aspect-auto h-64 w-full">
      {variant === "area" ? (
        <AreaChart data={points} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {axes}
          <Area
            dataKey="value"
            type="monotone"
            stroke="var(--color-value)"
            strokeWidth={2}
            fill="url(#scoreFill)"
            dot={{ r: 3, fill: "var(--color-value)", strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </AreaChart>
      ) : (
        <BarChart data={points} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          {axes}
          <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 0, 0]} maxBarSize={40} />
        </BarChart>
      )}
    </ChartContainer>
  );
}

/** "Mon 12" style label for a chart point, from an ISO date-time. */
export function chartDay(iso: string, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "short", day: "numeric" }).format(new Date(iso));
}

export function average(values: number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
}

export { formatNumber, formatPercent };
