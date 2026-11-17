"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Circle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
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
import { PageLoader } from "@/components/page-loader";
import { TableSkeletonRows } from "@/components/table-skeleton";
import type { TeacherClassroomStatus } from "./types";

export function TeacherClassroomsPage() {
  const t = useTranslations("TeacherClassroomsPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/my-classrooms");
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!isAuthLoading && user && !hasRole("teacher")) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, hasRole, router]);

  const {
    data: classrooms = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["teacher-classrooms"],
    queryFn: () =>
      apiFetch<{ classrooms: TeacherClassroomStatus[] }>("/api/teacher/classrooms").then(
        (d) => d.classrooms
      ),
    enabled: !isAuthLoading && !!user && hasRole("teacher"),
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [classrooms.length, isLoading],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("heading")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/attendance" />}>
            {t("takeAttendance")}
          </Button>
        </div>

        {!isLoading && classrooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noClassrooms")}</p>
        ) : (
          <div ref={rowsRef}>
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
                {isLoading ? (
                  <TableSkeletonRows columns={4} />
                ) : (
                  classrooms.map((classroom) => (
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </main>
  );
}
