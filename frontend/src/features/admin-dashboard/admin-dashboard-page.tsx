"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckSquare, ClipboardPlus, GraduationCap, Presentation, UserPlus, Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useMoney } from "@/hooks/use-money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiSkeleton, PanelSkeleton } from "@/components/app-skeletons";
import { Calendar } from "@/features/calendar/calendar";
import { OnboardingChecklist } from "@/features/onboarding/onboarding-checklist";
import { AttendanceChart, FeesChart, StagesDonut } from "./charts";
import { KpiCard, type KpiChange } from "./kpi-card";
import { ActivityFeed, AttentionPanel, MiniCalendar, UpcomingExams } from "./panels";
import { WeeklySummary } from "./weekly-summary";
import {
  attendanceRate,
  collected,
  formatNumber,
  formatPercent,
  greetingKey,
  intlLocale,
  markedDays,
  percentChange,
} from "./utils";
import type { AdminDashboard } from "./types";

export function AdminDashboardPage() {
  const t = useTranslations("AdminDashboardPage");
  const locale = useLocale();
  const money = useMoney();
  const { user, can } = useAuth();
  const hasFeature = (feature: string) => !user?.plan_features || user.plan_features.includes(feature);
  const showFees = hasFeature("fees");
  const showExams = hasFeature("exams");

  const { data: dashboard, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => apiFetch<{ dashboard: AdminDashboard }>("/api/admin/dashboard").then((d) => d.dashboard),
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const header = (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {t(greetingKey(), { name: user?.name ?? "" })}
        </h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "full" }).format(new Date())}
          {dashboard?.current_academic_year && (
            <Badge className="bg-brand-accent/15 text-brand-accent-strong ring-1 ring-brand-accent/30">{t("academicYearLabel", { year: dashboard.current_academic_year })}</Badge>
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {can("manage-students") && (
          <Button size="sm" nativeButton={false} render={<Link href="/students/new" />}>
            <UserPlus className="size-4" />
            {t("actionAddStudent")}
          </Button>
        )}
        {can("manage-attendance") && (
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/attendance" />}>
            <CheckSquare className="size-4" />
            {t("actionAttendance")}
          </Button>
        )}
        {showFees && can("manage-fees") && (
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/fees" />}>
            <Wallet className="size-4" />
            {t("actionFees")}
          </Button>
        )}
        {showExams && can("manage-exams") && (
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/exams/new" />}>
            <ClipboardPlus className="size-4" />
            {t("actionNewExam")}
          </Button>
        )}
      </div>
    </div>
  );

  if (!dashboard) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
        {header}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(["teal", "amber", "teal", "amber"] as const).map((tone, i) => (
            <KpiSkeleton key={i} tone={tone} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <PanelSkeleton className="lg:col-span-8" />
          <PanelSkeleton className="lg:col-span-4" variant="list" />
          <PanelSkeleton className="lg:col-span-6" />
          <PanelSkeleton className="lg:col-span-6" variant="list" />
        </div>
      </main>
    );
  }

  // Students: new enrollments this month, with the monthly series as sparkline.
  const enrollments = dashboard.enrollments_by_month;
  const newThisMonth = enrollments.at(-1)?.count ?? 0;

  // Attendance today vs the average of the previous marked days in the window.
  const today = dashboard.attendance_trend.at(-1);
  const todayRate = today ? attendanceRate(today) : null;
  const marked = markedDays(dashboard.attendance_trend);
  const previous = marked.filter((d) => d.date !== today?.date).slice(-7);
  const previousAvg = previous.length ? previous.reduce((s, d) => s + d.rate, 0) / previous.length : null;
  const attendanceChange: KpiChange | null =
    todayRate !== null && previousAvg !== null
      ? {
          value: todayRate - previousAvg,
          label: t("points", { value: formatNumber(Math.abs(todayRate - previousAvg), locale, 1) }),
          caption: t("vsWeekAverage"),
        }
      : null;

  // Fees: this month's collections vs last month's.
  const fees = dashboard.fees_by_month;
  const thisMonth = collected(fees.at(-1));
  const feesPct = percentChange(thisMonth, collected(fees.at(-2)));
  const feesChange: KpiChange | null =
    feesPct !== null
      ? { value: feesPct, label: formatPercent(Math.abs(feesPct), locale), caption: t("vsLastMonth") }
      : null;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
      {header}

      <OnboardingChecklist />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={GraduationCap}
          title={t("studentsHeading")}
          value={formatNumber(dashboard.students_count, locale)}
          href={can("manage-students") ? "/students" : undefined}
          spark={enrollments.map((m) => m.count)}
          subtext={t("newThisMonth", { count: newThisMonth })}
        />
        <KpiCard tone="amber"
          icon={Presentation}
          title={t("teachersHeading")}
          value={formatNumber(dashboard.teachers_count, locale)}
          href={can("manage-teachers") ? "/teachers" : undefined}
          subtext={t("teachersSubtext", {
            classrooms: dashboard.classrooms_count,
            parents: dashboard.parents_count,
          })}
        />
        <KpiCard
          icon={CheckSquare}
          title={t("attendanceTodayHeading")}
          value={todayRate === null ? "—" : formatPercent(todayRate, locale)}
          href={can("manage-attendance") ? "/attendance" : undefined}
          spark={marked.slice(-14).map((d) => d.rate)}
          change={attendanceChange}
          subtext={
            todayRate === null
              ? t("notMarkedToday")
              : t("presentOfMarked", {
                  present: (today?.present ?? 0) + (today?.late ?? 0),
                  marked: dashboard.attendance_marked_today,
                })
          }
        />
        {showFees ? (
          <KpiCard tone="amber"
            icon={Wallet}
            title={t("feesThisMonthHeading")}
            value={money(thisMonth)}
            href={can("manage-fees") ? "/fees" : undefined}
            spark={fees.map((m) => Number(m.collected))}
            change={feesChange}
            subtext={t("feesOutstandingLabel", { amount: money(dashboard.fees_outstanding) })}
          />
        ) : (
          <KpiCard tone="amber"
            icon={ClipboardPlus}
            title={t("upcomingMeetingsHeading")}
            value={formatNumber(dashboard.upcoming_meetings_count, locale)}
            href="/meetings"
          />
        )}
      </section>

      <WeeklySummary />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <AttendanceChart trend={dashboard.attendance_trend} className="lg:col-span-8" />
        <StagesDonut stages={dashboard.students_by_stage} className="lg:col-span-4" />

        {showFees && <FeesChart months={fees} className="lg:col-span-6" />}
        <AttentionPanel
          className={showFees ? "lg:col-span-6" : "lg:col-span-12"}
          showFees={showFees}
          overdueCount={dashboard.overdue_students_count}
          topOverdue={dashboard.top_overdue}
          isSchoolDay={dashboard.is_school_day}
          unmarked={dashboard.classrooms_unmarked_today}
          lowAttendanceCount={dashboard.low_attendance_students_count}
        />

        <ActivityFeed items={dashboard.recent_activity} className={showExams ? "lg:col-span-4" : "lg:col-span-6"} />
        {showExams && <UpcomingExams exams={dashboard.upcoming_exams} className="lg:col-span-4" />}
        <MiniCalendar className={showExams ? "lg:col-span-4" : "lg:col-span-6"} />
      </section>

      <section id="calendar" className="scroll-mt-20">
        <Calendar />
      </section>
    </main>
  );
}
