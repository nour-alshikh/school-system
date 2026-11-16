"use client";

import type { ComponentType, ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMoney } from "@/hooks/use-money";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/features/platform/format";
import type { CalendarEvent } from "@/features/calendar/types";
import type {
  AdminDashboardActivityType,
  AdminDashboardClassroomRefType,
  AdminDashboardExamType,
  AdminDashboardOverdueType,
} from "@/types/generated";
import { EmptyState, Panel } from "./charts";
import { intlLocale } from "./utils";

type Tone = "good" | "warning" | "critical";

const toneStyles: Record<Tone, { icon: ComponentType<{ className?: string }>; className: string }> = {
  good: { icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
  warning: { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400 bg-amber-500/10" },
  critical: { icon: AlertTriangle, className: "text-red-600 dark:text-red-400 bg-red-500/10" },
};

function AttentionRow({
  tone,
  title,
  detail,
  href,
  actionLabel,
  children,
}: {
  tone: Tone;
  title: string;
  detail: string;
  href?: string;
  actionLabel?: string;
  children?: ReactNode;
}) {
  const { icon: Icon, className } = toneStyles[tone];

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md", className)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
        {href && actionLabel && (
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href} />}>
            {actionLabel}
          </Button>
        )}
      </div>
      {children}
    </li>
  );
}

export function AttentionPanel({
  showFees,
  overdueCount,
  topOverdue,
  isSchoolDay,
  unmarked,
  lowAttendanceCount,
  className,
}: {
  showFees: boolean;
  overdueCount: number;
  topOverdue: AdminDashboardOverdueType[];
  isSchoolDay: boolean;
  unmarked: AdminDashboardClassroomRefType[];
  lowAttendanceCount: number;
  className?: string;
}) {
  const t = useTranslations("AdminDashboardPage");
  const locale = useLocale();
  const money = useMoney();
  const name = (en: string, ar: string) => (locale === "ar" ? ar || en : en || ar);

  return (
    <Panel className={className} title={t("attentionTitle")} description={t("attentionSubtitle")}>
      <ul className="flex flex-col gap-3">
        <AttentionRow
          tone={!isSchoolDay || unmarked.length === 0 ? "good" : "critical"}
          title={t("unmarkedTitle")}
          detail={
            !isSchoolDay
              ? t("noSchoolToday")
              : unmarked.length === 0
                ? t("allMarked")
                : t("unmarkedDetail", { count: unmarked.length })
          }
        >
          {isSchoolDay && unmarked.length > 0 && (
            <div className="flex flex-wrap gap-1.5 ps-11">
              {unmarked.slice(0, 8).map((c) => (
                <Link
                  key={c.id}
                  href={`/attendance?classroom=${c.id}`}
                  className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  {name(c.grade_name_en, c.grade_name_ar)} · {c.name}
                </Link>
              ))}
              {unmarked.length > 8 && (
                <span className="px-1 py-0.5 text-xs text-muted-foreground">
                  {t("andMore", { count: unmarked.length - 8 })}
                </span>
              )}
            </div>
          )}
        </AttentionRow>

        {showFees && (
          <AttentionRow
            tone={overdueCount === 0 ? "good" : "warning"}
            title={t("overdueTitle")}
            detail={overdueCount === 0 ? t("noOverdue") : t("overdueDetail", { count: overdueCount })}
            href={overdueCount > 0 ? "/fees" : undefined}
            actionLabel={t("view")}
          >
            {topOverdue.length > 0 && (
              <ul className="flex flex-col divide-y ps-11 text-sm">
                {topOverdue.map((s) => (
                  <li key={s.student_id} className="flex items-center justify-between gap-3 py-1.5">
                    <Link href={`/students/${s.student_id}`} className="truncate hover:text-primary hover:underline">
                      {name(s.name_en, s.name_ar)}
                    </Link>
                    <span className="font-medium tabular-nums">{money(s.outstanding)}</span>
                  </li>
                ))}
              </ul>
            )}
          </AttentionRow>
        )}

        <AttentionRow
          tone={lowAttendanceCount === 0 ? "good" : "warning"}
          title={t("lowAttendanceTitle")}
          detail={
            lowAttendanceCount === 0
              ? t("noLowAttendance")
              : t("lowAttendanceDetail", { count: lowAttendanceCount })
          }
          href={lowAttendanceCount > 0 ? "/attendance/history" : undefined}
          actionLabel={t("view")}
        />
      </ul>
    </Panel>
  );
}

const activityIcons: Record<AdminDashboardActivityType["type"], ComponentType<{ className?: string }>> = {
  payment: Wallet,
  student: UserPlus,
  exam: ClipboardList,
};

export function ActivityFeed({ items, className }: { items: AdminDashboardActivityType[]; className?: string }) {
  const t = useTranslations("AdminDashboardPage");
  const locale = useLocale();
  const money = useMoney();

  const href = (item: AdminDashboardActivityType) =>
    item.type === "exam" ? `/exams/${item.subject_id}` : item.subject_id ? `/students/${item.subject_id}` : undefined;

  return (
    <Panel className={className} title={t("activityTitle")}>
      {items.length === 0 ? (
        <EmptyState>{t("noActivity")}</EmptyState>
      ) : (
        <ol className="relative flex flex-col gap-4 before:absolute before:inset-y-2 before:start-4 before:w-px before:bg-border">
          {items.map((item, i) => {
            const Icon = activityIcons[item.type];
            const label = locale === "ar" ? item.label_ar || item.label_en : item.label_en || item.label_ar;
            const link = href(item);
            const text =
              item.type === "payment"
                ? t("activityPayment", { name: label, amount: money(item.amount) })
                : item.type === "student"
                  ? t("activityStudent", { name: label })
                  : t("activityExam", { title: label });

            return (
              <li key={`${item.type}-${item.subject_id}-${i}`} className="relative flex gap-3">
                <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-primary">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 pt-1">
                  {link ? (
                    <Link href={link} className="text-sm hover:text-primary hover:underline">
                      {text}
                    </Link>
                  ) : (
                    <p className="text-sm">{text}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{timeAgo(item.at, intlLocale(locale))}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

export function UpcomingExams({ exams, className }: { exams: AdminDashboardExamType[]; className?: string }) {
  const t = useTranslations("AdminDashboardPage");
  const locale = useLocale();
  const loc = intlLocale(locale);
  const day = new Intl.DateTimeFormat(loc, { day: "numeric" });
  const month = new Intl.DateTimeFormat(loc, { month: "short" });
  const time = new Intl.DateTimeFormat(loc, { timeStyle: "short" });

  return (
    <Panel
      className={className}
      title={t("examsTitle")}
      action={
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/exams" />}>
          {t("viewAll")}
          <ChevronRight className="size-4 rtl:-scale-x-100" />
        </Button>
      }
    >
      {exams.length === 0 ? (
        <EmptyState>{t("noUpcomingExams")}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {exams.map((exam) => {
            const opens = new Date(exam.opens_at);
            const subject = locale === "ar" ? exam.subject_name_ar : exam.subject_name_en;
            const grade = locale === "ar" ? exam.grade_name_ar : exam.grade_name_en;

            return (
              <li key={exam.id}>
                <Link
                  href={`/exams/${exam.id}`}
                  className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-muted/50"
                >
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-md bg-primary/10 py-1 text-primary">
                    <span className="text-lg leading-none font-semibold">{day.format(opens)}</span>
                    <span className="text-[11px] uppercase">{month.format(opens)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{exam.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[subject, grade, exam.classroom_name].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-end text-xs text-muted-foreground">
                    <span className="block">{time.format(opens)}</span>
                    <span className="block">{timeAgo(exam.opens_at, loc)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * This month at a glance: a dot on days with events, and the next few
 * events. Shares the full calendar's query, so it costs no extra request.
 */
export function MiniCalendar({ className }: { className?: string }) {
  const t = useTranslations("AdminDashboardPage");
  const locale = useLocale();
  const loc = intlLocale(locale);

  const { data: events = [] } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: () =>
      apiFetch<{ calendar_events: CalendarEvent[] }>("/api/calendar-events").then((d) => d.calendar_events),
  });

  const today = new Date();
  const todayISO = toISODate(today);
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const eventDates = new Set(events.map((e) => e.date));
  const upcoming = events
    .filter((e) => e.date >= todayISO)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  const weekday = new Intl.DateTimeFormat(loc, { weekday: "narrow" });
  const weekdays = Array.from({ length: 7 }, (_, i) => weekday.format(new Date(2023, 0, i + 1)));
  const cells = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(today.getFullYear(), today.getMonth(), i + 1)),
  ];
  const dayFmt = new Intl.DateTimeFormat(loc, { day: "numeric" });
  const eventDate = new Intl.DateTimeFormat(loc, { month: "short", day: "numeric" });

  return (
    <Panel
      className={className}
      title={new Intl.DateTimeFormat(loc, { month: "long", year: "numeric" }).format(today)}
      action={
        <Button variant="ghost" size="sm" nativeButton={false} render={<a href="#calendar" />}>
          {t("openCalendar")}
        </Button>
      }
    >
      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {weekdays.map((d, i) => (
          <span key={i} className="pb-1 font-medium text-muted-foreground">
            {d}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`blank-${i}`} />;
          const iso = toISODate(date);
          const isToday = iso === todayISO;
          return (
            <span key={iso} className="flex flex-col items-center gap-0.5 py-0.5">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full tabular-nums",
                  isToday && "bg-primary font-semibold text-primary-foreground"
                )}
              >
                {dayFmt.format(date)}
              </span>
              <span className={cn("size-1 rounded-full", eventDates.has(iso) ? "bg-brand-accent" : "bg-transparent")} />
            </span>
          );
        })}
      </div>

      <div className="mt-4 border-t pt-3">
        {upcoming.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("noUpcomingEvents")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((e) => {
              const [y, m, d] = e.date.split("-").map(Number);
              return (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <span className="size-1.5 shrink-0 rounded-full bg-brand-accent" />
                  <span className="flex-1 truncate">{e.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {eventDate.format(new Date(y, m - 1, d))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}

