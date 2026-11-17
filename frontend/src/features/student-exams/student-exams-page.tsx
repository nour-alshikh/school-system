"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
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
import type { ExamAttemptStatus, StudentExamListEntry } from "./types";

const statusBadgeClass: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  submitted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export function StudentExamsPage() {
  const t = useTranslations("StudentExamsPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/my-exams");
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!isAuthLoading && user && !hasRole("student")) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, hasRole, router]);

  const {
    data: exams = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["student-exams"],
    queryFn: () =>
      apiFetch<{ exams: StudentExamListEntry[] }>("/api/student/exams").then((d) => d.exams),
    enabled: !isAuthLoading && !!user && hasRole("student"),
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [exams.length, isLoading],
  });

  function statusOf(status: ExamAttemptStatus | null): "not_started" | ExamAttemptStatus {
    return status ?? "not_started";
  }

  const statusLabels: Record<string, string> = {
    not_started: t("statusNotStarted"),
    in_progress: t("statusInProgress"),
    submitted: t("statusSubmitted"),
  };

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>

        {!isLoading && exams.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noExams")}</p>
        ) : (
          <div ref={rowsRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("titleColumn")}</TableHead>
                  <TableHead>{t("subjectColumn")}</TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                  <TableHead>{t("scoreColumn")}</TableHead>
                  <TableHead className="text-end">{t("actionsColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeletonRows columns={5} />
                ) : (
                  exams.map((exam) => {
                    const status = statusOf(exam.attempt_status);
                    return (
                      <TableRow key={exam.id}>
                        <TableCell>{exam.title}</TableCell>
                        <TableCell>
                          {locale === "ar" ? exam.subject_name_ar : exam.subject_name_en}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[status]}`}
                          >
                            {statusLabels[status]}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {status === "submitted" ? `${exam.score ?? 0}/${exam.total_marks}` : "—"}
                        </TableCell>
                        <TableCell className="text-end">
                          {status === "submitted" ? (
                            <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/my-exams/${exam.id}/result`} />}>
                              {t("viewResult")}
                            </Button>
                          ) : (
                            <Button size="sm" nativeButton={false} render={<Link href={`/my-exams/${exam.id}`} />}>
                              {status === "in_progress" ? t("continue") : t("start")}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </main>
  );
}
