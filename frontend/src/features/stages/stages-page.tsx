"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageSkeleton } from "@/components/page-skeleton";
import { TableSkeletonRows } from "@/components/table-skeleton";
import { StageForm } from "./stage-form";
import type { Stage } from "./types";

export function StagesPage() {
  const t = useTranslations("StagesPage");
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canManage = can("manage-academics");

  const [editingStage, setEditingStage] = useState<Stage | null>(null);

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
      if (editingStage?.id === stage.id) setEditingStage(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
    },
  });

  if (isAuthLoading || !user) {
    return <PageSkeleton />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      {canManage && (
        <section className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold">
            {editingStage ? t("editStage") : t("newStage")}
          </h1>
          <StageForm
            key={editingStage?.id ?? "new"}
            stage={editingStage ?? undefined}
            onSuccess={() => setEditingStage(null)}
          />
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("stagesHeading")}</h2>

        {!isLoadingStages && stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noStages")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("nameEnColumn")}</TableHead>
                <TableHead>{t("nameArColumn")}</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingStages ? (
                <TableSkeletonRows columns={canManage ? 3 : 2} />
              ) : (
                stages.map((stage) => (
                  <TableRow key={stage.id}>
                    <TableCell>{stage.name_en}</TableCell>
                    <TableCell dir="rtl">{stage.name_ar}</TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingStage(stage)}
                          >
                            {t("edit")}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(stage)}
                          >
                            {t("delete")}
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
    </main>
  );
}
