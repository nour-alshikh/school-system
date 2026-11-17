"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, CheckSquare, CircleDashed, ClipboardList, ClipboardPlus, DoorOpen, Users, Video } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/features/calendar/calendar";
import { EmptyState, Panel } from "@/features/admin-dashboard/charts";
import { KpiCard } from "@/features/admin-dashboard/kpi-card";
import { timeAgo } from "@/features/platform/format";
import { intlLocale } from "@/features/admin-dashboard/utils";
import {
  AgendaPanel,
  ScoreChart,
  average,
  chartDay,
  DashboardHeader,
  formatNumber,
  formatPercent,
  useGreeting,
} from "@/features/role-dashboard/shared";
import type { TeacherDashboard } from "./types";

/** Classrooms listed under "Today's classes"; the rest are behind View all. */
const CLASSROOMS_SHOWN = 6;

function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function TeacherDashboardPage() {
  const t = useTranslations("RoleDashboards");
  const locale = useLocale();
  const { user } = useAuth();
  const greeting = useGreeting(user?.name ?? "");
  const hasFeature = (feature: string) => !user?.plan_features || user.plan_features.includes(feature);
  const showExams = hasFeature("exams");
  const showMeetings = hasFeature("meetings");

  const { data: d, error } = useQuery({
    queryKey: ["teacher-dashboard"],
    queryFn: () => apiFetch<{ dashboard: TeacherDashboard }>("/api/teacher/dashboard").then((r) => r.dashboard),
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const header = (
    <DashboardHeader
      title={greeting}
      actions={
        <>
          <Button size="sm" nativeButton={false} render={<Link href="/attendance" />}>
            <CheckSquare className="size-4" />
            {t("takeAttendance")}
          </Button>
          {showExams && (
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/exams/new" />}>
              <ClipboardPlus className="size-4" />
              {t("newExam")}
            </Button>
          )}
          {showMeetings && (
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/meetings" />}>
              <Video className="size-4" />
              {t("meetings")}
            </Button>
          )}
        </>
      }
    />
  );

  if (!d) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
        {header}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Skeleton className="h-80 rounded-xl lg:col-span-7" />
          <Skeleton className="h-80 rounded-xl lg:col-span-5" />
        </div>
      </main>
    );
  }

  const name = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const list = new Intl.ListFormat(intlLocale(locale), { style: "short", type: "unit" });
  const resultsAverage = average(d.exam_results.flatMap((r) => (r.average_percent === null ? [] : [r.average_percent])));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
      {header}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={DoorOpen} title={t("kpiClassrooms")} value={formatNumber(d.classrooms_count, locale)} href="/my-classrooms"
          subtext={t("kpiSubjects", { count: d.subjects_count })} />
        <KpiCard icon={Users} title={t("kpiStudents")} value={formatNumber(d.students_total, locale)} />
        <KpiCard
          icon={CheckSquare}
          title={t("kpiMarkedToday")}
          value={t("ofTotal", { value: formatNumber(d.attendance_marked_count, locale), total: formatNumber(d.classrooms_count, locale) })}
          href="/attendance"
          subtext={d.is_school_day ? t("classroomsMarked") : t("notSchoolDay")}
        />
        {showExams && (
          <KpiCard
            icon={ClipboardList}
            title={t("kpiAverageScore")}
            value={resultsAverage === null ? "—" : formatPercent(resultsAverage, locale, 0)}
            href="/exams"
            subtext={t("lastExams", { count: d.exam_results.length })}
          />
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          className="lg:col-span-7"
          title={t("todaysClasses")}
          description={d.is_school_day ? t("todaysClassesDesc") : t("notSchoolDay")}
          action={
            d.classrooms.length > CLASSROOMS_SHOWN && (
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/my-classrooms" />}>
                {t("viewAll")}
              </Button>
            )
          }
        >
          {d.classrooms.length === 0 ? (
            <EmptyState>{t("noClassrooms")}</EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {d.classrooms.slice(0, CLASSROOMS_SHOWN).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      c.marked_today ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {c.marked_today ? <CheckCircle2 className="size-4" /> : <CircleDashed className="size-4" />}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {list.format(locale === "ar" ? c.subjects_ar : c.subjects_en)}
                      {" · "}
                      {c.marked_today
                        ? t("presentOf", { present: formatNumber(c.present_today, locale), total: formatNumber(c.students_count, locale) })
                        : t("studentsCount", { count: c.students_count })}
                    </span>
                  </div>
                  {c.marked_today ? (
                    <Badge variant="secondary">{t("marked")}</Badge>
                  ) : (
                    d.is_school_day &&
                    c.students_count > 0 && (
                      <Button size="sm" nativeButton={false} render={<Link href={`/attendance?classroom=${c.id}`} />}>
                        {t("takeAttendance")}
                      </Button>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {showExams ? (
          <Panel
            className="lg:col-span-5"
            title={t("openExams")}
            description={t("openExamsDesc")}
            action={
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/exams" />}>
                {t("viewAll")}
              </Button>
            }
          >
            {d.open_exams.length === 0 ? (
              <EmptyState>{t("openExamsEmpty")}</EmptyState>
            ) : (
              <ul className="flex flex-col gap-3">
                {d.open_exams.map((exam) => (
                  <li key={exam.id}>
                    <Link href={`/exams/${exam.id}/results`} className="flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">{exam.title}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {name(exam.subject_name_en, exam.subject_name_ar)} · {t("closes", { when: timeAgo(exam.closes_at, locale) ?? "" })}
                          </span>
                        </div>
                        <span className="shrink-0 text-xs font-medium tabular-nums">
                          {t("ofTotal", { value: formatNumber(exam.submitted_count, locale), total: formatNumber(exam.eligible_count, locale) })}
                        </span>
                      </div>
                      <Progress value={exam.submitted_count} max={exam.eligible_count} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : (
          <AgendaPanel className="lg:col-span-5" items={d.agenda} hrefFor={(i) => (i.kind === "meeting" ? "/meetings" : undefined)} />
        )}

        {showExams && (
          <Panel className="lg:col-span-7" title={t("classPerformance")} description={t("classPerformanceDesc")}>
            {d.exam_results.length === 0 ? (
              <EmptyState>{t("noResults")}</EmptyState>
            ) : (
              <ScoreChart
                variant="bar"
                points={d.exam_results.map((r) => ({
                  key: String(r.id),
                  label: chartDay(r.closes_at, locale),
                  value: r.average_percent,
                  title: r.title,
                  rows: [
                    { label: t("average"), value: r.average_percent === null ? "—" : formatPercent(r.average_percent, locale) },
                    { label: t("submissions"), value: t("ofTotal", { value: formatNumber(r.submitted_count, locale), total: formatNumber(r.eligible_count, locale) }) },
                  ],
                }))}
              />
            )}
          </Panel>
        )}

        {showExams && (
          <AgendaPanel className="lg:col-span-5" items={d.agenda} hrefFor={(i) => (i.kind === "meeting" ? "/meetings" : undefined)} />
        )}
      </section>

      <div id="calendar" className="scroll-mt-20">
        <Calendar />
      </div>
    </main>
  );
}
