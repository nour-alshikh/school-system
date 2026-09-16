"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
import { Pagination, type PageMeta } from "@/components/pagination";
import { SearchInput } from "@/components/search-input";
import { StageForm } from "./stage-form";
import type { Stage } from "./types";

const PER_PAGE = 10;

export function StagesPage() {
  const t = useTranslations("StagesPage");
  const tTable = useTranslations("Table");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canManage = can("manage-academics");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingStage, setDeletingStage] = useState<Stage | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

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

  // A search change should jump back to page 1 and drop any selection made
  // on the previous result set — done here (during render, comparing
  // against the previous committed value) rather than in an effect, so it
  // takes effect in the same render instead of causing an extra one.
  const [prevSearch, setPrevSearch] = useState(search);
  if (search !== prevSearch) {
    setPrevSearch(search);
    setPage(1);
    setSelectedIds(new Set());
  }

  const {
    data,
    isLoading: isLoadingStages,
    error: stagesError,
  } = useQuery({
    queryKey: ["stages", page, search],
    queryFn: () =>
      apiFetch<{ stages: Stage[]; meta: PageMeta }>(
        `/api/stages?page=${page}&per_page=${PER_PAGE}&search=${encodeURIComponent(search)}`
      ),
    enabled: !isAuthLoading && !!user,
  });

  const stages = data?.stages ?? [];
  const meta = data?.meta;

  useEffect(() => {
    if (!stagesError) return;

    toast.error(
      stagesError instanceof ApiError ? stagesError.message : t("loadError")
    );
  }, [stagesError, t]);

  // Deleting the last item on a page (other than page 1) would otherwise
  // strand the view on a now-empty page — clamp back as soon as a fresh
  // response says so, and drop the now-stale selection with it.
  const [prevMeta, setPrevMeta] = useState<PageMeta | undefined>(undefined);
  if (meta && meta !== prevMeta) {
    setPrevMeta(meta);
    if (meta.total > 0 && page > meta.last_page) {
      setPage(meta.last_page);
      setSelectedIds(new Set());
    }
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    setSelectedIds(new Set());
  }

  const deleteMutation = useMutation({
    mutationFn: (stage: Stage) =>
      apiFetch<void>(`/api/stages/${stage.id}`, { method: "DELETE" }),
    onSuccess: (_data, stage) => {
      queryClient.invalidateQueries({ queryKey: ["stages"], exact: false });
      toast.success(t("deleteSuccess"));
      if (editingStage?.id === stage.id) setDialogOpen(false);
      setDeletingStage(null);
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

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) =>
      apiFetch<void>("/api/stages/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stages"], exact: false });
      toast.success(t("bulkDeleteSuccess"));
      setSelectedIds(new Set());
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : t("bulkDeleteError")
      );
    },
  });

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleteConfirmOpen(true);
  }

  function handleConfirmBulkDelete() {
    bulkDeleteMutation.mutate(Array.from(selectedIds), {
      onSuccess: () => setBulkDeleteConfirmOpen(false),
    });
  }

  function toggleRow(id: number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(stages.map((s) => s.id)) : new Set());
  }

  const allSelected =
    stages.length > 0 && stages.every((s) => selectedIds.has(s.id));

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [stages.length, page, search, isLoadingStages],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("stagesHeading")}</h2>
          <div className="flex items-center gap-2">
            {canManage && selectedIds.size > 0 && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={bulkDeleteMutation.isPending}
                onClick={handleBulkDelete}
              >
                {bulkDeleteMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {t("deleteSelected", { count: selectedIds.size })}
              </Button>
            )}
            {canManage && (
              <Button type="button" size="sm" onClick={openCreateDialog}>
                <Plus className="size-4" />
                {t("newStage")}
              </Button>
            )}
          </div>
        </div>

        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t("searchPlaceholder")}
        />

        {!isLoadingStages && stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search ? t("noResults") : t("noStages")}
          </p>
        ) : (
          <div ref={rowsRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage && (
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label={tTable("selectAll")}
                        checked={allSelected}
                        onCheckedChange={(checked) => toggleAll(!!checked)}
                      />
                    </TableHead>
                  )}
                  <TableHead>{t("nameColumn")}</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingStages ? (
                  <TableSkeletonRows columns={canManage ? 3 : 1} />
                ) : (
                  stages.map((stage) => (
                    <TableRow key={stage.id}>
                      {canManage && (
                        <TableCell>
                          <Checkbox
                            aria-label={tTable("selectRow")}
                            checked={selectedIds.has(stage.id)}
                            onCheckedChange={(checked) =>
                              toggleRow(stage.id, !!checked)
                            }
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        {locale === "ar" ? stage.name_ar : stage.name_en}
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
                              onClick={() => openEditDialog(stage)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon-sm"
                              aria-label={t("delete")}
                              title={t("delete")}
                              disabled={deletingId === stage.id}
                              onClick={() => setDeletingStage(stage)}
                            >
                              {deletingId === stage.id ? (
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
          </div>
        )}

        {meta && <Pagination meta={meta} onPageChange={handlePageChange} />}
      </section>

      {canManage && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
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

      <ConfirmDialog
        open={!!deletingStage}
        onOpenChange={(open) => !open && setDeletingStage(null)}
        title={t("confirmDeleteTitle")}
        description={t("confirmDeleteDescription", {
          name: deletingStage
            ? locale === "ar"
              ? deletingStage.name_ar
              : deletingStage.name_en
            : "",
        })}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingStage && deleteMutation.mutate(deletingStage)}
      />

      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        onOpenChange={setBulkDeleteConfirmOpen}
        title={t("confirmBulkDeleteTitle")}
        description={t("confirmBulkDelete", { count: selectedIds.size })}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        isLoading={bulkDeleteMutation.isPending}
        onConfirm={handleConfirmBulkDelete}
      />
    </main>
  );
}
