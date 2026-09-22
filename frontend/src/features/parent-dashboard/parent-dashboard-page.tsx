"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/features/calendar/calendar";
import type { Student } from "@/features/parent-portal/types";
import type { ParentAttendanceSummary } from "@/features/parent-attendance/types";
import type { ParentFeesSummary } from "@/features/parent-fees/types";

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

export function ParentDashboardPage() {
  const t = useTranslations("ParentDashboardPage");
  const locale = useLocale();
  const { user } = useAuth();

  // Same query key as parent-portal/student-info.tsx's StudentInfo — shares
  // its cache, so navigating to /parent right after doesn't refetch.
  const {
    data: student,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["parent-student"],
    queryFn: () => apiFetch<{ student: Student }>("/api/parent/student").then((d) => d.student),
  });

  // Same query keys as the full /parent-attendance and /parent-fees pages —
  // shares their cache, so navigating there right after doesn't refetch.
  const { data: attendance, error: attendanceError } = useQuery({
    queryKey: ["parent-attendance"],
    queryFn: () =>
      apiFetch<{ summary: ParentAttendanceSummary }>("/api/parent/attendance"),
  });

  const { data: fees, error: feesError } = useQuery({
    queryKey: ["parent-fees"],
    queryFn: () => apiFetch<{ summary: ParentFeesSummary }>("/api/parent/fees"),
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  useEffect(() => {
    if (!attendanceError) return;
    toast.error(
      attendanceError instanceof ApiError ? attendanceError.message : t("attendanceLoadError")
    );
  }, [attendanceError, t]);

  useEffect(() => {
    if (!feesError) return;
    toast.error(feesError instanceof ApiError ? feesError.message : t("feesLoadError"));
  }, [feesError, t]);

  if (!user) return null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card heading={t("profileHeading")} href="/parent" linkLabel={t("editProfile")}>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </Card>

        <Card heading={t("studentHeading")} href="/parent" linkLabel={t("viewStudent")}>
          {isLoading || !student ? (
            <div className="h-10 animate-pulse rounded-md bg-muted/30" />
          ) : (
            <>
              <p className="font-medium">
                {locale === "ar" ? student.name_ar : student.name_en}
              </p>
              <p className="text-sm text-muted-foreground">
                {locale === "ar" ? student.grade.name_ar : student.grade.name_en} ·{" "}
                {student.classroom.name} ·{" "}
                {locale === "ar" ? student.academic_year.name_ar : student.academic_year.name_en}
              </p>
            </>
          )}
        </Card>

        <Card
          heading={t("attendanceHeading")}
          href="/parent-attendance"
          linkLabel={t("viewAttendance")}
        >
          {!attendance ? (
            <div className="h-10 animate-pulse rounded-md bg-muted/30" />
          ) : (
            <>
              <p className="text-2xl font-bold">
                {attendance.summary.present}/{attendance.summary.total}
              </p>
              <p className="text-sm text-muted-foreground">{t("presentLabel")}</p>
            </>
          )}
        </Card>

        <Card heading={t("feesHeading")} href="/parent-fees" linkLabel={t("viewFees")}>
          {!fees ? (
            <div className="h-10 animate-pulse rounded-md bg-muted/30" />
          ) : (
            <>
              <p className="text-2xl font-bold">
                {Number(fees.summary.total_outstanding).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">{t("outstandingLabel")}</p>
            </>
          )}
        </Card>
      </div>

      <Calendar />
    </main>
  );
}
