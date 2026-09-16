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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { GradeForm } from "./grade-form";
import type { Grade } from "./types";
import type { Stage } from "@/features/stages/types";

const PER_PAGE = 10;
const ALL_STAGES = "all";

export function GradesPage() {
  const t = useTranslations("GradesPage");
  const tTable = useTranslations("Table");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canManage = can("manage-academics");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [stageFilter, setStageFilter] = useState<string>(ALL_STAGES);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingGrade, setDeletingGrade] = useState<Grade | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

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

  // A search or stage-filter change should jump back to page 1 and drop any
  // selection made on the previous result set — done here (during render,
  // comparing against the previous committed value) rather than in an
  // effect, so it takes effect in the same render instead of causing an
  // extra one.
  const filtersKey = `${search}::${stageFilter}`;
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
  if (filtersKey !== prevFiltersKey) {
    setPrevFiltersKey(filtersKey);
    setPage(1);
    setSelectedIds(new Set());
  }

  const {
    data,
    isLoading: isLoadingGrades,
    error: gradesError,
  } = useQuery({
    queryKey: ["grades", page, search, stageFilter],
    queryFn: () =>
      apiFetch<{ grades: Grade[]; meta: PageMeta }>(
        `/api/grades?page=${page}&per_page=${PER_PAGE}&search=${encodeURIComponent(search)}` +
          (stageFilter !== ALL_STAGES ? `&stage_id=${stageFilter}` : "")
      ),
    enabled: !isAuthLoading && !!user,
  });

  const grades = data?.grades ?? [];
  const meta = data?.meta;

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

  const stageFilterItems = [
    { value: ALL_STAGES, label: t("allStages") },
    ...stages.map((stage) => ({
      value: String(stage.id),
      label: locale === "ar" ? stage.name_ar : stage.name_en,
    })),
  ];

  useEffect(() => {
    if (!gradesError) return;

    toast.error(
      gradesError instanceof ApiError ? gradesError.message : t("loadError")
    );
  }, [gradesError, t]);

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
    mutationFn: (grade: Grade) =>
      apiFetch<void>(`/api/grades/${grade.id}`, { method: "DELETE" }),
    onSuccess: (_data, grade) => {
      queryClient.invalidateQueries({ queryKey: ["grades"], exact: false });
      toast.success(t("deleteSuccess"));
      if (editingGrade?.id === grade.id) setDialogOpen(false);
      setDeletingGrade(null);
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

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) =>
      apiFetch<void>("/api/grades/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"], exact: false });
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
    setSelectedIds(checked ? new Set(grades.map((g) => g.id)) : new Set());
  }

  const allSelected =
    grades.length > 0 && grades.every((g) => selectedIds.has(g.id));

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [grades.length, page, search, stageFilter, isLoadingGrades],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("gradesHeading")}</h2>
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
                {t("newGrade")}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder={t("searchPlaceholder")}
          />
          <Select
            items={stageFilterItems}
            value={stageFilter}
            onValueChange={(value) => setStageFilter(value ?? ALL_STAGES)}
          >
            <SelectTrigger aria-label={t("stageFilterLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stageFilterItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isLoadingGrades && grades.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search || stageFilter !== ALL_STAGES
              ? t("noResults")
              : t("noGrades")}
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
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                  )}
                  <TableHead>{t("nameColumn")}</TableHead>
                  <TableHead>{t("stageColumn")}</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingGrades ? (
                  <TableSkeletonRows columns={canManage ? 4 : 2} />
                ) : (
                  grades.map((grade) => (
                    <TableRow key={grade.id}>
                      {canManage && (
                        <TableCell>
                          <Checkbox
                            aria-label={tTable("selectRow")}
                            checked={selectedIds.has(grade.id)}
                            onCheckedChange={(checked) =>
                              toggleRow(grade.id, checked)
                            }
                          />
                        </TableCell>
                      )}
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
                              onClick={() => setDeletingGrade(grade)}
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
          </div>
        )}

        {meta && <Pagination meta={meta} onPageChange={handlePageChange} />}
      </section>

      {canManage && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[85vh] sm:max-w-lg overflow-y-auto">
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

      <ConfirmDialog
        open={!!deletingGrade}
        onOpenChange={(open) => !open && setDeletingGrade(null)}
        title={t("confirmDeleteTitle")}
        description={t("confirmDeleteDescription", {
          name: deletingGrade
            ? locale === "ar"
              ? deletingGrade.name_ar
              : deletingGrade.name_en
            : "",
        })}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingGrade && deleteMutation.mutate(deletingGrade)}
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
