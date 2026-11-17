"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, CheckSquare, ClipboardList, FileText, Link2, Timer, Trophy, Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useMoney } from "@/hooks/use-money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiSkeleton, PanelSkeleton } from "@/components/app-skeletons";
import { Calendar } from "@/features/calendar/calendar";
import { EmptyState, Panel } from "@/features/admin-dashboard/charts";
import { KpiCard } from "@/features/admin-dashboard/kpi-card";
import { timeAgo } from "@/features/platform/format";
import {
  AgendaPanel,
  attendanceRateOf,
  average,
  chartDay,
  DashboardHeader,
  headerBadgeClass,
  formatNumber,
  formatPercent,
  ScoreChart,
} from "@/features/role-dashboard/shared";
import type { StudentDashboard } from "./types";

export function StudentDashboardPage() {
  const t = useTranslations("RoleDashboards");
  const locale = useLocale();
  const { user } = useAuth();
  const hasFeature = (feature: string) => !user?.plan_features || user.plan_features.includes(feature);
  const showExams = hasFeature("exams");
  const showFees = hasFeature("fees");
  const showLibrary = hasFeature("library");

  const { data: d, error } = useQuery({
    queryKey: ["student-dashboard"],
    queryFn: () => apiFetch<{ dashboard: StudentDashboard }>("/api/student/dashboard").then((r) => r.dashboard),
  });
  const money = useMoney(d?.currency);

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const firstName = (user?.name ?? "").split(" ")[0];
  const name = (en: string, ar: string) => (locale === "ar" ? ar : en);

  const header = (
    <DashboardHeader
      title={t("hi", { name: firstName })}
      badges={
        d && (
          <Badge className={headerBadgeClass}>
            {name(d.student.grade.name_en, d.student.grade.name_ar)} · {d.student.classroom.name}
          </Badge>
        )
      }
      actions={
        showExams && (
          <Button size="sm" nativeButton={false} render={<Link href="/my-exams" />}>
            <ClipboardList className="size-4" />
            {t("myExams")}
          </Button>
        )
      }
    />
  );

  if (!d) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
        {header}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(["teal", "amber", "teal", "amber"] as const).map((tone, i) => <KpiSkeleton key={i} tone={tone} />)}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <PanelSkeleton className="lg:col-span-5" variant="list" />
          <PanelSkeleton className="lg:col-span-7" />
        </div>
      </main>
    );
  }

  const rate = attendanceRateOf(d.attendance_summary);
  const scoreAverage = average(d.score_trend.map((s) => s.percent));
  const outstanding = Number(d.fees_summary.total_outstanding);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
      {header}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={CheckSquare}
          title={t("kpiAttendance")}
          value={rate === null ? "—" : formatPercent(rate, locale, 0)}
          href="/my-attendance"
          subtext={t("daysPresent", {
            present: formatNumber(d.attendance_summary.present + d.attendance_summary.late, locale),
            total: formatNumber(d.attendance_summary.total, locale),
          })}
        />
        {showExams && (
          <KpiCard tone="amber"
            icon={ClipboardList}
            title={t("kpiExamsToTake")}
            value={formatNumber(d.upcoming_exams.length, locale)}
            href="/my-exams"
            subtext={d.next_exam ? t("nextCloses", { when: timeAgo(d.next_exam.closes_at, locale) ?? "" }) : t("nothingDue")}
          />
        )}
        {showExams && (
          <KpiCard
            icon={Trophy}
            title={t("kpiAverageScore")}
            value={scoreAverage === null ? "—" : formatPercent(scoreAverage, locale, 0)}
            spark={d.score_trend.map((s) => s.percent)}
            subtext={t("lastExams", { count: d.score_trend.length })}
          />
        )}
        {showFees ? (
          <KpiCard tone="amber"
            icon={Wallet}
            title={t("kpiFeesOutstanding")}
            value={money(d.fees_summary.total_outstanding)}
            href="/my-fees"
            subtext={outstanding > 0 ? t("ofTotalDue", { total: money(d.fees_summary.total_due) }) : t("allPaid")}
          />
        ) : (
          <KpiCard icon={BookOpen} title={t("kpiSubjectsTitle")} value={formatNumber(d.subjects_count, locale)} href="/my-subjects" />
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <AgendaPanel
          className="lg:col-span-5"
          title={t("yourWeek")}
          items={d.agenda}
          hrefFor={(i) => (i.kind === "meeting" ? "/my-meetings" : i.kind === "exam" ? `/my-exams/${i.id}` : undefined)}
        />

        {showExams && (
          <Panel
            className="lg:col-span-7"
            title={t("upcomingExams")}
            action={
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/my-exams" />}>
                {t("viewAll")}
              </Button>
            }
          >
            {d.upcoming_exams.length === 0 ? (
              <EmptyState>{t("upcomingExamsEmpty")}</EmptyState>
            ) : (
              <ul className="flex flex-col gap-2">
                {d.upcoming_exams.map((exam) => {
                  const open = new Date(exam.opens_at) <= new Date();
                  const started = exam.attempt_status === "in_progress";
                  return (
                    <li key={exam.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent/15 text-amber-700 dark:text-amber-300">
                        <Timer className="size-4" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{exam.title}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {name(exam.subject_name_en, exam.subject_name_ar)} ·{" "}
                          {open
                            ? t("closes", { when: timeAgo(exam.closes_at, locale) ?? "" })
                            : t("opens", { when: timeAgo(exam.opens_at, locale) ?? "" })}
                        </span>
                      </div>
                      {open ? (
                        <Button size="sm" variant={started ? "outline" : "default"} nativeButton={false} render={<Link href={`/my-exams/${exam.id}`} />}>
                          {started ? t("continueExam") : t("startExam")}
                        </Button>
                      ) : (
                        <Badge variant="secondary">{t("notOpenYet")}</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        )}

        {showExams && (
          <Panel className="lg:col-span-7" title={t("yourScores")} description={t("yourScoresDesc")}>
            {d.score_trend.length === 0 ? (
              <EmptyState>{t("noScores")}</EmptyState>
            ) : (
              <ScoreChart
                variant="area"
                points={d.score_trend.map((s) => ({
                  key: `${s.exam_id}`,
                  label: chartDay(s.submitted_at, locale),
                  value: s.percent,
                  title: s.title,
                  rows: [
                    { label: name(s.subject_name_en, s.subject_name_ar), value: formatPercent(s.percent, locale, 0) },
                    { label: t("marks"), value: t("ofTotal", { value: formatNumber(s.score, locale), total: formatNumber(s.total_marks, locale) }) },
                  ],
                }))}
              />
            )}
          </Panel>
        )}

        {showLibrary && (
          <Panel
            className="lg:col-span-5"
            title={t("newInLibrary")}
            description={t("forYourGrade")}
            action={
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/my-library" />}>
                {t("viewAll")}
              </Button>
            }
          >
            {d.library_resources.length === 0 ? (
              <EmptyState>{t("libraryEmpty")}</EmptyState>
            ) : (
              <ul className="flex flex-col gap-2">
                {d.library_resources.map((r) => (
                  <li key={r.id}>
                    <Link href="/my-library" className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-teal-300">
                        {r.type === "link" ? <Link2 className="size-4" /> : <FileText className="size-4" />}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{r.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.type === "link" ? t("kindLink") : t("kindFile")} · {timeAgo(r.created_at, locale)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </section>

      <div id="calendar" className="scroll-mt-20">
        <Calendar />
      </div>
    </main>
  );
}
