"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/features/calendar/calendar";
import type { AdminDashboard } from "./types";

function StatCard({
  heading,
  value,
  subtext,
  href,
  linkLabel,
}: {
  heading: string;
  value: string | number;
  subtext?: string;
  href?: string;
  linkLabel?: string;
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
      <p className="text-2xl font-bold">{value}</p>
      {subtext && <p className="text-sm text-muted-foreground">{subtext}</p>}
    </section>
  );
}

export function AdminDashboardPage() {
  const t = useTranslations("AdminDashboardPage");

  const {
    data: dashboard,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () =>
      apiFetch<{ dashboard: AdminDashboard }>("/api/admin/dashboard").then(
        (d) => d.dashboard
      ),
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  if (isLoading || !dashboard) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg border bg-muted/30" />
          ))}
        </div>
      </main>
    );
  }

  const {
    students_count,
    teachers_count,
    parents_count,
    classrooms_count,
    current_academic_year,
    fees_collected,
    fees_outstanding,
    attendance_present_today,
    attendance_marked_today,
    library_resources_count,
  } = dashboard;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          heading={t("studentsHeading")}
          value={students_count}
          href="/students"
          linkLabel={t("view")}
        />
        <StatCard
          heading={t("teachersHeading")}
          value={teachers_count}
          href="/teachers"
          linkLabel={t("view")}
        />
        <StatCard heading={t("parentsHeading")} value={parents_count} />
        <StatCard
          heading={t("classroomsHeading")}
          value={classrooms_count}
          href="/classrooms"
          linkLabel={t("view")}
        />
        <StatCard
          heading={t("feesCollectedHeading")}
          value={fees_collected}
          subtext={t("feesOutstandingLabel", { amount: fees_outstanding })}
          href="/fees"
          linkLabel={t("view")}
        />
        <StatCard
          heading={t("attendanceTodayHeading")}
          value={`${attendance_present_today}/${attendance_marked_today}`}
          subtext={t("presentTodayLabel")}
          href="/attendance"
          linkLabel={t("view")}
        />
        <StatCard
          heading={t("libraryHeading")}
          value={library_resources_count}
          subtext={
            current_academic_year
              ? t("academicYearLabel", { year: current_academic_year })
              : undefined
          }
          href="/library"
          linkLabel={t("view")}
        />
      </div>

      <Calendar />
    </main>
  );
}
