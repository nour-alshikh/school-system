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
import type { Exam, ExamAttemptStatus, ExamResultEntry } from "./types";

const statusBadgeClass: Record<ExamAttemptStatus, string> = {
  in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  submitted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export function ExamResultsPage({ id }: { id: string }) {
  const t = useTranslations("ExamResultsPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can, hasRole } = useAuth();
  const router = useRouter();

  const canAccess = can("manage-exams") || hasRole("teacher");

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace(`/login?redirect=/exams/${id}/results`);
    }
  }, [isAuthLoading, user, router, id]);

  const {
    data: exam,
    isLoading: isLoadingExam,
  } = useQuery({
    queryKey: ["exams", id],
    queryFn: () => apiFetch<{ exam: Exam }>(`/api/exams/${id}`).then((d) => d.exam),
    enabled: !isAuthLoading && !!user && canAccess,
  });

  const {
    data: results = [],
    isLoading: isLoadingResults,
    error,
  } = useQuery({
    queryKey: ["exam-results", id],
    queryFn: () =>
      apiFetch<{ results: ExamResultEntry[] }>(`/api/exams/${id}/results`).then((d) => d.results),
    enabled: !isAuthLoading && !!user && canAccess,
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [results.length, isLoadingResults],
  });

  const statusLabels: Record<ExamAttemptStatus, string> = {
    in_progress: t("statusInProgress"),
    submitted: t("statusSubmitted"),
  };

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          {isLoadingExam ? t("heading") : t("headingWithTitle", { title: exam?.title ?? "" })}
        </h2>
        {exam && (
          <p className="text-sm text-muted-foreground">
            {t("totalMarks", { total: exam.total_marks })}
          </p>
        )}

        {!isLoadingResults && results.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noStudents")}</p>
        ) : (
          <div ref={rowsRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("studentColumn")}</TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                  <TableHead>{t("scoreColumn")}</TableHead>
                  <TableHead>{t("submittedAtColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingResults ? (
                  <TableSkeletonRows columns={4} />
                ) : (
                  results.map((row) => (
                    <TableRow key={row.student_id}>
                      <TableCell>
                        {locale === "ar" ? row.student_name_ar : row.student_name_en}
                      </TableCell>
                      <TableCell>
                        {row.status ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[row.status]}`}
                          >
                            {statusLabels[row.status]}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t("statusNotStarted")}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.score != null ? `${row.score}/${exam?.total_marks ?? ""}` : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.submitted_at ? new Date(row.submitted_at).toLocaleString(locale) : "—"}
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
