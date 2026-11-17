"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMoney } from "@/hooks/use-money";
import type {
  AdminDashboardAttendanceDayType,
  AdminDashboardFeeMonthType,
  AdminDashboardStageCountType,
} from "@/types/generated";
import {
  formatNumber,
  formatPercent,
  intlLocale,
  markedDays,
  shortDate,
  shortMonth,
} from "./utils";

/** Card with a title row, used by every dashboard panel. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="font-semibold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">{children}</CardContent>
    </Card>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="grid min-w-36 gap-1.5 rounded-lg border bg-background px-2.5 py-2 text-xs shadow-xl">
      <p className="font-medium">{title}</p>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {row.color && <span className="size-2 rounded-[2px]" style={{ background: row.color }} />}
            {row.label}
          </span>
          <span className="font-mono font-medium tabular-nums text-foreground">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

const attendanceConfig = { rate: { label: "rate", color: "var(--chart-1)" } } satisfies ChartConfig;

/**
 * Daily attendance rate over the trend window. Days nothing was marked
 * (weekends, holidays) are left out rather than drawn as 0%.
 */
export function AttendanceChart({ trend, className }: { trend: AdminDashboardAttendanceDayType[]; className?: string }) {
  const t = useTranslations("AdminDashboardPage");
  const locale = useLocale();
  const rtl = locale === "ar";
  const days = markedDays(trend);
  const average = days.length ? days.reduce((sum, d) => sum + d.rate, 0) / days.length : null;

  return (
    <Panel
      className={className}
      title={t("attendanceChartTitle")}
      description={t("last30Days")}
      action={
        average !== null && (
          <div className="text-end">
            <p className="text-lg font-semibold tabular-nums">{formatPercent(average, locale)}</p>
            <p className="text-xs text-muted-foreground">{t("average")}</p>
          </div>
        )
      }
    >
      {days.length === 0 ? (
        <EmptyState>{t("noAttendanceYet")}</EmptyState>
      ) : (
        <ChartContainer config={attendanceConfig} className="aspect-auto h-64 w-full">
          <AreaChart data={days} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-rate)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-rate)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              reversed={rtl}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={(d: string) => shortDate(d, locale)}
            />
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
              cursor={{ strokeWidth: 1 }}
              content={({ active, payload }) => {
                const day = active ? (payload?.[0]?.payload as (typeof days)[number] | undefined) : undefined;
                if (!day) return null;
                return (
                  <TooltipBox
                    title={shortDate(day.date, locale)}
                    rows={[
                      { label: t("rate"), value: formatPercent(day.rate, locale), color: "var(--color-rate)" },
                      { label: t("present"), value: formatNumber(day.present, locale) },
                      { label: t("late"), value: formatNumber(day.late, locale) },
                      { label: t("absent"), value: formatNumber(day.absent, locale) },
                      { label: t("excused"), value: formatNumber(day.excused, locale) },
                    ]}
                  />
                );
              }}
            />
            <Area
              dataKey="rate"
              type="monotone"
              stroke="var(--color-rate)"
              strokeWidth={2}
              fill="url(#attendanceFill)"
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            />
          </AreaChart>
        </ChartContainer>
      )}
    </Panel>
  );
}

/** Up to four stages get their own color; any more fold into "Other" in gray. */
const STAGE_SLOTS = 4;

export function StagesDonut({ stages, className }: { stages: AdminDashboardStageCountType[]; className?: string }) {
  const t = useTranslations("AdminDashboardPage");
  const locale = useLocale();
  const total = stages.reduce((sum, s) => sum + s.count, 0);

  const named = stages.slice(0, STAGE_SLOTS).map((s, i) => ({
    key: `stage-${s.stage_id}`,
    name: locale === "ar" ? s.name_ar : s.name_en,
    count: s.count,
    color: `var(--chart-${i + 1})`,
  }));
  const rest = stages.slice(STAGE_SLOTS).reduce((sum, s) => sum + s.count, 0);
  const slices = rest > 0
    ? [...named, { key: "other", name: t("otherStages"), count: rest, color: "var(--muted-foreground)" }]
    : named;

  return (
    <Panel className={className} title={t("stagesChartTitle")} description={t("activeStudents")}>
      {total === 0 ? (
        <EmptyState>{t("noStudentsYet")}</EmptyState>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          <div className="relative mx-auto aspect-square w-full max-w-48">
            <ChartContainer config={{}} className="aspect-square w-full">
              <PieChart>
                <ChartTooltip
                  content={({ active, payload }) => {
                    const slice = active ? (payload?.[0]?.payload as (typeof slices)[number] | undefined) : undefined;
                    if (!slice) return null;
                    return (
                      <TooltipBox
                        title={slice.name}
                        rows={[
                          { label: t("students"), value: formatNumber(slice.count, locale), color: slice.color },
                          { label: t("share"), value: formatPercent((slice.count / total) * 100, locale) },
                        ]}
                      />
                    );
                  }}
                />
                <Pie
                  data={slices.filter((s) => s.count > 0)}
                  dataKey="count"
                  nameKey="name"
                  innerRadius="68%"
                  outerRadius="100%"
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={2}
                  cornerRadius={4}
                  isAnimationActive={false}
                >
                  {slices.filter((s) => s.count > 0).map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold tabular-nums">{formatNumber(total, locale)}</span>
              <span className="text-xs text-muted-foreground">{t("total")}</span>
            </div>
          </div>

          <ul className="grid gap-2 text-sm">
            {slices.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
                <span className="flex-1 truncate">{s.name}</span>
                <span className="font-medium tabular-nums">{formatNumber(s.count, locale)}</span>
                <span className="w-12 text-end text-muted-foreground tabular-nums">
                  {formatPercent((s.count / total) * 100, locale, 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

const feesConfig = {
  charged: { label: "charged", color: "var(--chart-2)" },
  collected: { label: "collected", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Charges raised vs payments received per month, on one money axis. */
export function FeesChart({ months, className }: { months: AdminDashboardFeeMonthType[]; className?: string }) {
  const t = useTranslations("AdminDashboardPage");
  const locale = useLocale();
  const money = useMoney();
  const rtl = locale === "ar";
  const data = months.map((m) => ({ month: m.month, charged: Number(m.charged), collected: Number(m.collected) }));
  const empty = data.every((m) => m.charged === 0 && m.collected === 0);
  const compact = new Intl.NumberFormat(intlLocale(locale), { notation: "compact", maximumFractionDigits: 1 });

  const legend = (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      {(["collected", "charged"] as const).map((key) => (
        <span key={key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: feesConfig[key].color }} />
          {t(key === "collected" ? "collected" : "charged")}
        </span>
      ))}
    </div>
  );

  return (
    <Panel className={className} title={t("feesChartTitle")} description={t("last6Months")} action={!empty && legend}>
      {empty ? (
        <EmptyState>{t("noFeesYet")}</EmptyState>
      ) : (
        <ChartContainer config={feesConfig} className="aspect-auto min-h-64 w-full flex-1">
          <BarChart data={data} barGap={2} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              reversed={rtl}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(m: string) => shortMonth(m, locale)}
            />
            <YAxis
              orientation={rtl ? "right" : "left"}
              width={48}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => compact.format(v)}
            />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={({ active, payload }) => {
                const row = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined;
                if (!row) return null;
                return (
                  <TooltipBox
                    title={shortMonth(row.month, locale)}
                    rows={[
                      { label: t("collected"), value: money(row.collected), color: "var(--color-collected)" },
                      { label: t("charged"), value: money(row.charged), color: "var(--color-charged)" },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="collected" fill="var(--color-collected)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="charged" fill="var(--color-charged)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ChartContainer>
      )}
    </Panel>
  );
}
