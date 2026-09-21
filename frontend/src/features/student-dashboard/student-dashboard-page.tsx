"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { AttendanceStatus, StudentDashboard } from "./types";

const attendanceBadgeClass: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  absent: "bg-red-500/10 text-red-600 dark:text-red-400",
  late: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  excused: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

function Card({
  heading,
  href,
  linkLabel,
  children,
}: {
  heading: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{heading}</h3>
        <Button variant="outline" size="sm" render={<Link href={href} />}>
          {linkLabel}
        </Button>
      </div>
      {children}
    </section>
  );
}

export function StudentDashboardPage() {
  const t = useTranslations("StudentDashboardPage");
  const locale = useLocale();

  const {
    data: dashboard,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["student-dashboard"],
    queryFn: () =>
      apiFetch<{ dashboard: StudentDashboard }>("/api/student/dashboard").then(
        (d) => d.dashboard
      ),
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const attendanceStatusLabels: Record<AttendanceStatus, string> = {
    present: t("attendancePresent"),
    absent: t("attendanceAbsent"),
    late: t("attendanceLate"),
    excused: t("attendanceExcused"),
  };

  if (isLoading || !dashboard) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
        <div className="h-24 animate-pulse rounded-lg border bg-muted/30" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="h-32 animate-pulse rounded-lg border bg-muted/30" />
          <div className="h-32 animate-pulse rounded-lg border bg-muted/30" />
          <div className="h-32 animate-pulse rounded-lg border bg-muted/30" />
        </div>
      </main>
    );
  }

  const { student, attendance_summary, latest_attendance, subjects_count, fees_summary } =
    dashboard;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <h3 className="text-sm font-semibold">{t("profileHeading")}</h3>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">{t("gradeLabel")}</p>
            <p className="font-medium">
              {locale === "ar" ? student.grade.name_ar : student.grade.name_en}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("classroomLabel")}</p>
            <p className="font-medium">{student.classroom.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("academicYearLabel")}</p>
            <p className="font-medium">
              {locale === "ar"
                ? student.academic_year.name_ar
                : student.academic_year.name_en}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card heading={t("attendanceHeading")} href="/my-attendance" linkLabel={t("viewHistory")}>
          <div className="flex flex-wrap gap-2">
            {(["present", "absent", "late", "excused"] as const).map((status) => (
              <span
                key={status}
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${attendanceBadgeClass[status]}`}
              >
                {attendanceStatusLabels[status]}: {attendance_summary[status]}
              </span>
            ))}
          </div>
          {latest_attendance ? (
            <p className="text-sm text-muted-foreground">
              {t("latestAttendanceLabel")}: {latest_attendance.date} —{" "}
              {attendanceStatusLabels[latest_attendance.status]}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noAttendance")}</p>
          )}
        </Card>

        <Card heading={t("subjectsHeading")} href="/my-subjects" linkLabel={t("viewSubjects")}>
          <p className="text-2xl font-bold">{subjects_count}</p>
          <p className="text-sm text-muted-foreground">{t("subjectsCountLabel")}</p>
        </Card>

        <Card heading={t("feesHeading")} href="/my-fees" linkLabel={t("viewFees")}>
          <p className="text-sm text-muted-foreground">
            {t("totalOutstandingLabel")}:{" "}
            <span className="font-medium text-foreground">
              {Number(fees_summary.total_outstanding).toFixed(2)}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {t("totalDueLabel")}: {Number(fees_summary.total_due).toFixed(2)}
          </p>
        </Card>
      </div>
    </main>
  );
}
