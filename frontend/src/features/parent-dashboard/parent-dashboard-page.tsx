"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/features/calendar/calendar";
import { useParentChildren } from "@/features/parent-children/use-parent-children";
import type { ParentChildType } from "@/types/generated";

/**
 * One card per child — at every school this parent is a parent at — with
 * links into the per-child pages (see docs/multi-tenancy.md, Decisions).
 */
function ChildCard({ child }: { child: ParentChildType }) {
  const t = useTranslations("ParentDashboardPage");
  const locale = useLocale();
  const { student, attendance, fees } = child;
  const query = `?student=${student.id}`;

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="font-semibold">
          {locale === "ar" ? student.name_ar : student.name_en}
        </h3>
        <p className="text-sm text-muted-foreground">{child.school_name}</p>
        <p className="text-sm text-muted-foreground">
          {locale === "ar" ? student.grade.name_ar : student.grade.name_en} ·{" "}
          {student.classroom.name}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-2xl font-bold">
            {attendance.present}/{attendance.total}
          </p>
          <p className="text-sm text-muted-foreground">{t("presentLabel")}</p>
        </div>
        <div>
          <p className="text-2xl font-bold">
            {Number(fees.total_outstanding).toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground">{t("outstandingLabel")}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" render={<Link href={`/parent${query}`} />}>
          {t("viewStudent")}
        </Button>
        <Button variant="outline" size="sm" render={<Link href={`/parent-attendance${query}`} />}>
          {t("viewAttendance")}
        </Button>
        <Button variant="outline" size="sm" render={<Link href={`/parent-fees${query}`} />}>
          {t("viewFees")}
        </Button>
        <Button variant="outline" size="sm" render={<Link href={`/parent-library${query}`} />}>
          {t("viewLibrary")}
        </Button>
      </div>
    </section>
  );
}

export function ParentDashboardPage() {
  const t = useTranslations("ParentDashboardPage");
  const { user } = useAuth();

  const { data: children, isLoading, error } = useParentChildren();

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  if (!user) return null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">{t("profileHeading")}</h3>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="outline" size="sm" render={<Link href="/parent" />}>
          {t("editProfile")}
        </Button>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("childrenHeading")}</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {isLoading || !children
            ? [0, 1].map((i) => (
                <div key={i} className="h-44 animate-pulse rounded-lg bg-muted/30" />
              ))
            : children.map((child) => <ChildCard key={child.student.id} child={child} />)}
        </div>
      </section>

      <Calendar />
    </main>
  );
}
