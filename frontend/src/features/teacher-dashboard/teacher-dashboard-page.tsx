"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/features/calendar/calendar";
import type { ExamStatus, TeacherDashboard } from "./types";

const examStatusBadgeClass: Record<ExamStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

function Card({
  heading,
  href,
  linkLabel,
  children,
}: {
  heading: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{heading}</h3>
        {href && linkLabel && (
          <Button variant="outline" size="sm" render={<Link href={href} />}>
            {linkLabel}
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

export function TeacherDashboardPage() {
  const t = useTranslations("TeacherDashboardPage");
  const locale = useLocale();

  const {
    data: dashboard,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["teacher-dashboard"],
    queryFn: () =>
      apiFetch<{ dashboard: TeacherDashboard }>("/api/teacher/dashboard").then(
        (d) => d.dashboard
      ),
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const examStatusLabels: Record<ExamStatus, string> = {
    draft: t("examStatusDraft"),
    published: t("examStatusPublished"),
  };

  if (isLoading || !dashboard) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/30" />
          ))}
        </div>
      </main>
    );
  }

  const {
    classrooms_count,
    subjects_count,
    students_total,
    attendance_marked_count,
    exams_total,
    latest_exam,
  } = dashboard;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card heading={t("classroomsHeading")} href="/my-classrooms" linkLabel={t("viewClassrooms")}>
          <p className="text-2xl font-bold">{classrooms_count}</p>
        </Card>

        <Card heading={t("subjectsLabel")}>
          <p className="text-2xl font-bold">{subjects_count}</p>
        </Card>

        <Card heading={t("studentsLabel")}>
          <p className="text-2xl font-bold">{students_total}</p>
        </Card>

        <Card
          heading={t("attendanceHeading")}
          href="/attendance"
          linkLabel={t("takeAttendance")}
        >
          <p className="text-2xl font-bold">
            {attendance_marked_count}/{classrooms_count}
          </p>
          <p className="text-sm text-muted-foreground">{t("markedTodayLabel")}</p>
        </Card>

        <Card heading={t("examsHeading")} href="/exams" linkLabel={t("viewAllExams")}>
          <p className="text-2xl font-bold">{exams_total}</p>
          {latest_exam ? (
            <p className="text-sm text-muted-foreground">
              {latest_exam.title} —{" "}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${examStatusBadgeClass[latest_exam.status]}`}
              >
                {examStatusLabels[latest_exam.status]}
              </span>{" "}
              ({locale === "ar" ? latest_exam.subject_name_ar : latest_exam.subject_name_en})
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noExams")}</p>
          )}
        </Card>
      </div>

      <Calendar />
    </main>
  );
}
