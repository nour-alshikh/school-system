"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/table-skeleton";
import type {
  AttendanceStatus,
  FeeChargeStatus,
  StudentDashboard,
} from "./types";

const attendanceBadgeClass: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  absent: "bg-red-500/10 text-red-600 dark:text-red-400",
  late: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  excused: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

const feeBadgeClass: Record<FeeChargeStatus, string> = {
  unpaid: "bg-muted text-muted-foreground",
  partial: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  waived: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">{heading}</h3>
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

  const attendanceRowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [dashboard?.recent_attendance.length, isLoading],
  });

  const attendanceStatusLabels: Record<AttendanceStatus, string> = {
    present: t("attendancePresent"),
    absent: t("attendanceAbsent"),
    late: t("attendanceLate"),
    excused: t("attendanceExcused"),
  };

  const feeStatusLabels: Record<FeeChargeStatus, string> = {
    unpaid: t("feeUnpaid"),
    partial: t("feePartial"),
    paid: t("feePaid"),
    waived: t("feeWaived"),
  };

  if (isLoading || !dashboard) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
        <div className="h-24 animate-pulse rounded-lg border bg-muted/30" />
        <div className="h-40 animate-pulse rounded-lg border bg-muted/30" />
      </main>
    );
  }

  const { student, attendance_summary, recent_attendance, subjects, fee_charges, fees_summary } =
    dashboard;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <Section heading={t("profileHeading")}>
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
      </Section>

      <Section heading={t("attendanceHeading")}>
        <div className="flex flex-wrap gap-2">
          {(["present", "absent", "late", "excused"] as const).map((status) => (
            <span
              key={status}
              className={`rounded-full px-3 py-1 text-xs font-medium ${attendanceBadgeClass[status]}`}
            >
              {attendanceStatusLabels[status]}: {attendance_summary[status]}
            </span>
          ))}
        </div>

        {recent_attendance.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noAttendance")}</p>
        ) : (
          <div ref={attendanceRowsRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dateColumn")}</TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                  <TableHead>{t("notesColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeletonRows columns={3} />
                ) : (
                  recent_attendance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-muted-foreground">{record.date}</TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${attendanceBadgeClass[record.status]}`}
                        >
                          {attendanceStatusLabels[record.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.notes ?? ""}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section heading={t("subjectsHeading")}>
        {subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noSubjects")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("subjectColumn")}</TableHead>
                <TableHead>{t("teacherColumn")}</TableHead>
                <TableHead>{t("teacherEmailColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((subject) => (
                <TableRow key={subject.subject_id}>
                  <TableCell>
                    {locale === "ar" ? subject.subject_name_ar : subject.subject_name_en}
                  </TableCell>
                  <TableCell>{subject.teacher_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {subject.teacher_email ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section heading={t("feesHeading")}>
        {fee_charges.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noFees")}</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("feeColumn")}</TableHead>
                  <TableHead>{t("dueColumn")}</TableHead>
                  <TableHead>{t("paidColumn")}</TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fee_charges.map((charge) => (
                  <TableRow key={charge.id}>
                    <TableCell>
                      {locale === "ar" ? charge.fee_name_ar : charge.fee_name_en}
                    </TableCell>
                    <TableCell>{Number(charge.amount_due).toFixed(2)}</TableCell>
                    <TableCell>{Number(charge.amount_paid).toFixed(2)}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${feeBadgeClass[charge.status]}`}
                      >
                        {feeStatusLabels[charge.status]}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap gap-4 text-sm">
              <p>
                {t("totalDueLabel")}:{" "}
                <span className="font-medium">{Number(fees_summary.total_due).toFixed(2)}</span>
              </p>
              <p>
                {t("totalPaidLabel")}:{" "}
                <span className="font-medium">{Number(fees_summary.total_paid).toFixed(2)}</span>
              </p>
              <p>
                {t("totalOutstandingLabel")}:{" "}
                <span className="font-medium">
                  {Number(fees_summary.total_outstanding).toFixed(2)}
                </span>
              </p>
            </div>
          </>
        )}
      </Section>
    </main>
  );
}
