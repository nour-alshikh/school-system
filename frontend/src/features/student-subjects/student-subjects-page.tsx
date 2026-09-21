"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
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
import { PageLoader } from "@/components/page-loader";
import { TableSkeletonRows } from "@/components/table-skeleton";
import type { StudentClassSubject } from "./types";

export function StudentSubjectsPage() {
  const t = useTranslations("StudentSubjectsPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/my-subjects");
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!isAuthLoading && user && !hasRole("student")) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, hasRole, router]);

  const {
    data: subjects = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["student-subjects"],
    queryFn: () =>
      apiFetch<{ subjects: StudentClassSubject[] }>("/api/student/subjects").then(
        (d) => d.subjects
      ),
    enabled: !isAuthLoading && !!user && hasRole("student"),
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [subjects.length, isLoading],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>

        {!isLoading && subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noSubjects")}</p>
        ) : (
          <div ref={rowsRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("subjectColumn")}</TableHead>
                  <TableHead>{t("teacherColumn")}</TableHead>
                  <TableHead>{t("teacherEmailColumn")}</TableHead>
                  <TableHead>{t("teacherPhoneColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeletonRows columns={4} />
                ) : (
                  subjects.map((subject) => (
                    <TableRow key={subject.subject_id}>
                      <TableCell>
                        {locale === "ar" ? subject.subject_name_ar : subject.subject_name_en}
                      </TableCell>
                      <TableCell>{subject.teacher_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {subject.teacher_email ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {subject.teacher_phone ?? "—"}
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
