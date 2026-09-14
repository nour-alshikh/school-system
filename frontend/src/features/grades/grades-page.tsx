"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { GradeForm } from "./grade-form";
import type { Grade } from "./types";
import type { Stage } from "@/features/stages/types";

export function GradesPage() {
  const t = useTranslations("GradesPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canManage = can("manage-academics");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);

  function openCreateDialog() {
    setEditingGrade(null);
    setDialogOpen(true);
  }

  function openEditDialog(grade: Grade) {
    setEditingGrade(grade);
    setDialogOpen(true);
  }

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/grades");
    }
  }, [isAuthLoading, user, router]);

  const {
    data: grades = [],
    isLoading: isLoadingGrades,
    error: gradesError,
  } = useQuery({
    queryKey: ["grades"],
    queryFn: () =>
      apiFetch<{ grades: Grade[] }>("/api/grades").then((d) => d.grades),
    enabled: !isAuthLoading && !!user,
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["stages"],
    queryFn: () =>
      apiFetch<{ stages: Stage[] }>("/api/stages").then((d) => d.stages),
    enabled: !isAuthLoading && !!user,
  });

  const stageNameById = new Map(
    stages.map((stage) => [
      stage.id,
      locale === "ar" ? stage.name_ar : stage.name_en,
    ])
  );

  useEffect(() => {
    if (!gradesError) return;

    toast.error(
      gradesError instanceof ApiError ? gradesError.message : t("loadError")
    );
  }, [gradesError, t]);

  const deleteMutation = useMutation({
    mutationFn: (grade: Grade) =>
      apiFetch<void>(`/api/grades/${grade.id}`, { method: "DELETE" }),
    onSuccess: (_data, grade) => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      toast.success(t("deleteSuccess"));
      if (editingGrade?.id === grade.id) setDialogOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
    },
  });

  // One mutation backs every row's delete button, so `isPending` alone can't
  // tell which row is in flight — `variables` (the grade passed to
  // `mutate()`) does, letting only that row disable/spin instead of freezing
  // the whole table.
  const deletingId = deleteMutation.isPending
    ? deleteMutation.variables?.id
    : undefined;

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("gradesHeading")}</h2>
          {canManage && (
            <Button type="button" size="sm" onClick={openCreateDialog}>
              <Plus className="size-4" />
              {t("newGrade")}
            </Button>
          )}
        </div>

        {!isLoadingGrades && grades.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noGrades")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("nameColumn")}</TableHead>
                <TableHead>{t("stageColumn")}</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingGrades ? (
                <TableSkeletonRows columns={canManage ? 3 : 2} />
              ) : (
                grades.map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell>
                      {locale === "ar" ? grade.name_ar : grade.name_en}
                    </TableCell>
                    <TableCell>
                      {stageNameById.get(grade.stage_id) ?? "—"}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label={t("edit")}
                            title={t("edit")}
                            onClick={() => openEditDialog(grade)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon-sm"
                            aria-label={t("delete")}
                            title={t("delete")}
                            disabled={deletingId === grade.id}
                            onClick={() => deleteMutation.mutate(grade)}
                          >
                            {deletingId === grade.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </section>

      {canManage && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingGrade ? t("editGrade") : t("newGrade")}
              </DialogTitle>
            </DialogHeader>
            <GradeForm
              key={editingGrade?.id ?? "new"}
              grade={editingGrade ?? undefined}
              onSuccess={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}
