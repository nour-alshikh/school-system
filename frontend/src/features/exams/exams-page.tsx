"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BarChart3, Pencil, Plus, Trash2 } from "lucide-react";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageLoader } from "@/components/page-loader";
import { TableSkeletonRows } from "@/components/table-skeleton";
import type { Exam, ExamStatus } from "./types";

const statusBadgeClass: Record<ExamStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export function ExamsPage() {
  const t = useTranslations("ExamsPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can, hasRole } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canAccess = can("manage-exams") || hasRole("teacher");

  const [deletingExam, setDeletingExam] = useState<Exam | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/exams");
    }
  }, [isAuthLoading, user, router]);

  const {
    data: exams = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["exams"],
    queryFn: () => apiFetch<{ exams: Exam[] }>("/api/exams").then((d) => d.exams),
    enabled: !isAuthLoading && !!user && canAccess,
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const deleteMutation = useMutation({
    mutationFn: (exam: Exam) => apiFetch<void>(`/api/exams/${exam.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"], exact: false });
      toast.success(t("deleteSuccess"));
      setDeletingExam(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
      setDeletingExam(null);
    },
  });

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [exams.length, isLoading],
  });

  const statusLabels: Record<ExamStatus, string> = {
    draft: t("statusDraft"),
    published: t("statusPublished"),
  };

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("heading")}</h2>
          <Button type="button" size="sm" onClick={() => router.push("/exams/new")}>
            <Plus className="size-4" />
            {t("newExam")}
          </Button>
        </div>

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
                  <TableHead>{t("targetColumn")}</TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                  <TableHead>{t("submittedColumn")}</TableHead>
                  <TableHead className="text-end">{t("actionsColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeletonRows columns={6} />
                ) : (
                  exams.map((exam) => (
                    <TableRow key={exam.id}>
                      <TableCell>{exam.title}</TableCell>
                      <TableCell>
                        {locale === "ar" ? exam.subject.name_ar : exam.subject.name_en}
                      </TableCell>
                      <TableCell>
                        {exam.classroom
                          ? exam.classroom.name
                          : t("wholeGrade", {
                              grade: locale === "ar" ? exam.grade.name_ar : exam.grade.name_en,
                            })}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[exam.status]}`}
                        >
                          {statusLabels[exam.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {exam.submitted_count}/{exam.attempts_count}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" nativeButton={false} render={<Link href={`/exams/${exam.id}/results`} aria-label={t("viewResults")} />}>
                            <BarChart3 className="size-4" />
                          </Button>
                          <Button
                            nativeButton={false}
                            variant="ghost"
                            size="icon"
                            disabled={exam.attempts_count > 0}
                            render={<Link href={`/exams/${exam.id}`} aria-label={t("edit")} />}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={exam.attempts_count > 0}
                            onClick={() => setDeletingExam(exam)}
                            aria-label={t("delete")}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!deletingExam}
        onOpenChange={(open) => !open && setDeletingExam(null)}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingExam && deleteMutation.mutate(deletingExam)}
      />
    </main>
  );
}
