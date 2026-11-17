"use client";

import type { ComponentType, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface KpiChange {
  /** Signed amount of change; its sign picks the arrow and color. */
  value: number;
  /** Already formatted, e.g. "12.3%" or "+4". */
  label: string;
  /** e.g. "vs last month". */
  caption: string;
}

/** The two brand colors, alternated across a KPI row. */
const TONES = {
  teal: { chip: "bg-primary/10 text-primary dark:text-teal-300", line: "var(--chart-1)", bar: "bg-primary" },
  amber: { chip: "bg-brand-accent/15 text-brand-accent-strong", line: "var(--chart-2)", bar: "bg-brand-accent" },
} as const;

export type KpiTone = keyof typeof TONES;

/**
 * A headline number with an optional sparkline and change badge. The
 * sparkline is decoration for the trend's shape only — the number and the
 * badge carry the information — so it has no axes or tooltip.
 */
export function KpiCard({
  icon: Icon,
  title,
  value,
  change,
  subtext,
  spark,
  href,
  tone = "teal",
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
  change?: KpiChange | null;
  subtext?: ReactNode;
  spark?: number[];
  href?: string;
  tone?: KpiTone;
}) {
  const style = TONES[tone];
  const body = (
    <Card className="relative h-full gap-3 overflow-hidden px-4 pb-2 transition-[box-shadow,translate] hover:-translate-y-0.5 hover:shadow-md">
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", style.bar)} />
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", style.chip)}>
          <Icon className="size-4" />
        </span>
        <span className="text-sm font-medium">{title}</span>
      </div>

      <p className="truncate text-3xl font-semibold tracking-tight tabular-nums">{value}</p>

      <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {change && <ChangeBadge change={change} />}
        {change && <span>{change.caption}</span>}
        {!change && subtext}
      </div>
      {change && subtext && <div className="-mt-2 text-xs text-muted-foreground">{subtext}</div>}
      {spark && spark.length > 1 && <Sparkline values={spark} color={style.line} />}
    </Card>
  );

  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

function ChangeBadge({ change }: { change: KpiChange }) {
  const Icon = change.value > 0 ? ArrowUpRight : change.value < 0 ? ArrowDownRight : Minus;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums",
        change.value > 0 && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        change.value < 0 && "bg-red-500/10 text-red-700 dark:text-red-400",
        change.value === 0 && "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="size-3.5 rtl:-scale-x-100" />
      {change.label}
    </span>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const data = values.map((v, i) => ({ i, v }));

  return (
    <div className="mt-auto h-10 w-full rtl:-scale-x-100" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
