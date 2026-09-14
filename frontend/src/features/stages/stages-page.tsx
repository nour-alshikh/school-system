"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
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
import { StageForm } from "./stage-form";
import type { Stage } from "./types";

export function StagesPage() {
  const t = useTranslations("StagesPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canManage = can("manage-academics");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);

  function openCreateDialog() {
    setEditingStage(null);
    setDialogOpen(true);
  }

  function openEditDialog(stage: Stage) {
    setEditingStage(stage);
    setDialogOpen(true);
  }

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/stages");
    }
  }, [isAuthLoading, user, router]);

  const {
    data: stages = [],
    isLoading: isLoadingStages,
    error: stagesError,
  } = useQuery({
    queryKey: ["stages"],
    queryFn: () =>
      apiFetch<{ stages: Stage[] }>("/api/stages").then((d) => d.stages),
    enabled: !isAuthLoading && !!user,
  });

  useEffect(() => {
    if (!stagesError) return;

    toast.error(
      stagesError instanceof ApiError ? stagesError.message : t("loadError")
    );
  }, [stagesError, t]);

  const deleteMutation = useMutation({
    mutationFn: (stage: Stage) =>
      apiFetch<void>(`/api/stages/${stage.id}`, { method: "DELETE" }),
    onSuccess: (_data, stage) => {
      queryClient.invalidateQueries({ queryKey: ["stages"] });
      toast.success(t("deleteSuccess"));
      if (editingStage?.id === stage.id) setDialogOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
    },
  });

  // One mutation backs every row's delete button, so `isPending` alone can't
  // tell which row is in flight — `variables` (the stage passed to
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
          <h2 className="text-lg font-semibold">{t("stagesHeading")}</h2>
          {canManage && (
            <Button type="button" size="sm" onClick={openCreateDialog}>
              <Plus className="size-4" />
              {t("newStage")}
            </Button>
          )}
        </div>

        {!isLoadingStages && stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noStages")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("nameColumn")}</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingStages ? (
                <TableSkeletonRows columns={canManage ? 2 : 1} />
              ) : (
                stages.map((stage) => (
                  <TableRow key={stage.id}>
                    <TableCell>
                      {locale === "ar" ? stage.name_ar : stage.name_en}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(stage)}
                          >
                            {t("edit")}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={deletingId === stage.id}
                            onClick={() => deleteMutation.mutate(stage)}
                          >
                            {deletingId === stage.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              t("delete")
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
                {editingStage ? t("editStage") : t("newStage")}
              </DialogTitle>
            </DialogHeader>
            <StageForm
              key={editingStage?.id ?? "new"}
              stage={editingStage ?? undefined}
              onSuccess={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}
