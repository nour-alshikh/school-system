"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Circle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExamStatus, TeacherDashboard } from "./types";

const examStatusBadgeClass: Record<ExamStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

function Section({
  heading,
  action,
  children,
}: {
  heading: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{heading}</h3>
        {action}
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

  const classroomRowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [dashboard?.classrooms.length, isLoading],
  });

  const examStatusLabels: Record<ExamStatus, string> = {
    draft: t("examStatusDraft"),
    published: t("examStatusPublished"),
  };

  if (isLoading || !dashboard) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
        <div className="h-24 animate-pulse rounded-lg border bg-muted/30" />
        <div className="h-40 animate-pulse rounded-lg border bg-muted/30" />
      </main>
    );
  }

  const { assignments, students_total, classrooms, exams } = dashboard;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <Section heading={t("summaryHeading")}>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">{t("classroomsLabel")}</p>
            <p className="font-medium">{classrooms.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("subjectsLabel")}</p>
            <p className="font-medium">
              {new Set(assignments.map((a) => a.subject_id)).size}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("studentsLabel")}</p>
            <p className="font-medium">{students_total}</p>
          </div>
        </div>
      </Section>

      <Section
        heading={t("classroomsHeading")}
        action={
          <Button variant="outline" size="sm" render={<Link href="/attendance" />}>
            {t("takeAttendance")}
          </Button>
        }
      >
        {classrooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noClassrooms")}</p>
        ) : (
          <div ref={classroomRowsRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("classroomColumn")}</TableHead>
                  <TableHead>{t("gradeColumn")}</TableHead>
                  <TableHead>{t("studentCountColumn")}</TableHead>
                  <TableHead>{t("attendanceTodayColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classrooms.map((classroom) => (
                  <TableRow key={classroom.classroom_id}>
                    <TableCell>{classroom.classroom_name}</TableCell>
                    <TableCell>
                      {locale === "ar" ? classroom.grade_name_ar : classroom.grade_name_en}
                    </TableCell>
                    <TableCell>{classroom.student_count}</TableCell>
                    <TableCell>
                      {classroom.attendance_marked_today ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-4" />
                          {t("marked")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Circle className="size-4" />
                          {t("notMarked")}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section
        heading={t("examsHeading")}
        action={
          <Button variant="outline" size="sm" render={<Link href="/exams" />}>
            {t("viewAllExams")}
          </Button>
        }
      >
        {exams.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noExams")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("titleColumn")}</TableHead>
                <TableHead>{t("subjectColumn")}</TableHead>
                <TableHead>{t("statusColumn")}</TableHead>
                <TableHead>{t("submittedColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell>{exam.title}</TableCell>
                  <TableCell>
                    {locale === "ar" ? exam.subject_name_ar : exam.subject_name_en}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${examStatusBadgeClass[exam.status]}`}
                    >
                      {examStatusLabels[exam.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {exam.submitted_count}/{exam.eligible_count}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </main>
  );
}
