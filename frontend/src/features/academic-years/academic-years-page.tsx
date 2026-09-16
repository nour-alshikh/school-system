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
import { AcademicYearForm } from "./academic-year-form";
import type { AcademicYear } from "./types";

const PER_PAGE = 10;

export function AcademicYearsPage() {
  const t = useTranslations("AcademicYearsPage");
  const tTable = useTranslations("Table");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canManage = can("manage-academics");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAcademicYear, setEditingAcademicYear] =
    useState<AcademicYear | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingAcademicYear, setDeletingAcademicYear] =
    useState<AcademicYear | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  function openCreateDialog() {
    setEditingAcademicYear(null);
    setDialogOpen(true);
  }

  function openEditDialog(academicYear: AcademicYear) {
    setEditingAcademicYear(academicYear);
    setDialogOpen(true);
  }

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/academic-years");
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
    isLoading: isLoadingAcademicYears,
    error: academicYearsError,
  } = useQuery({
    queryKey: ["academic-years", page, search],
    queryFn: () =>
      apiFetch<{ academic_years: AcademicYear[]; meta: PageMeta }>(
        `/api/academic-years?page=${page}&per_page=${PER_PAGE}&search=${encodeURIComponent(search)}`
      ),
    enabled: !isAuthLoading && !!user,
  });

  const academicYears = data?.academic_years ?? [];
  const meta = data?.meta;

  useEffect(() => {
    if (!academicYearsError) return;

    toast.error(
      academicYearsError instanceof ApiError
        ? academicYearsError.message
        : t("loadError")
    );
  }, [academicYearsError, t]);

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
    mutationFn: (academicYear: AcademicYear) =>
      apiFetch<void>(`/api/academic-years/${academicYear.id}`, {
        method: "DELETE",
      }),
    onSuccess: (_data, academicYear) => {
      queryClient.invalidateQueries({
        queryKey: ["academic-years"],
        exact: false,
      });
      toast.success(t("deleteSuccess"));
      if (editingAcademicYear?.id === academicYear.id) setDialogOpen(false);
      setDeletingAcademicYear(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
    },
  });

  // One mutation backs every row's delete button, so `isPending` alone can't
  // tell which row is in flight — `variables` (the academic year passed to
  // `mutate()`) does, letting only that row disable/spin instead of freezing
  // the whole table.
  const deletingId = deleteMutation.isPending
    ? deleteMutation.variables?.id
    : undefined;

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) =>
      apiFetch<void>("/api/academic-years/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["academic-years"],
        exact: false,
      });
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
    setSelectedIds(
      checked ? new Set(academicYears.map((a) => a.id)) : new Set()
    );
  }

  const allSelected =
    academicYears.length > 0 &&
    academicYears.every((a) => selectedIds.has(a.id));

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [academicYears.length, page, search, isLoadingAcademicYears],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("academicYearsHeading")}
          </h2>
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
                {t("newAcademicYear")}
              </Button>
            )}
          </div>
        </div>

        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t("searchPlaceholder")}
        />

        {!isLoadingAcademicYears && academicYears.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search ? t("noResults") : t("noAcademicYears")}
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
                  <TableHead>{t("currentColumn")}</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingAcademicYears ? (
                  <TableSkeletonRows columns={canManage ? 4 : 2} />
                ) : (
                  academicYears.map((academicYear) => (
                    <TableRow key={academicYear.id}>
                      {canManage && (
                        <TableCell>
                          <Checkbox
                            aria-label={tTable("selectRow")}
                            checked={selectedIds.has(academicYear.id)}
                            onCheckedChange={(checked) =>
                              toggleRow(academicYear.id, !!checked)
                            }
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        {locale === "ar"
                          ? academicYear.name_ar
                          : academicYear.name_en}
                      </TableCell>
                      <TableCell>
                        {academicYear.is_current ? t("yes") : t("no")}
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
                              onClick={() => openEditDialog(academicYear)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon-sm"
                              aria-label={t("delete")}
                              title={t("delete")}
                              disabled={deletingId === academicYear.id}
                              onClick={() =>
                                setDeletingAcademicYear(academicYear)
                              }
                            >
                              {deletingId === academicYear.id ? (
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
                {editingAcademicYear
                  ? t("editAcademicYear")
                  : t("newAcademicYear")}
              </DialogTitle>
            </DialogHeader>
            <AcademicYearForm
              key={editingAcademicYear?.id ?? "new"}
              academicYear={editingAcademicYear ?? undefined}
              onSuccess={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!deletingAcademicYear}
        onOpenChange={(open) => !open && setDeletingAcademicYear(null)}
        title={t("confirmDeleteTitle")}
        description={t("confirmDeleteDescription", {
          name: deletingAcademicYear
            ? locale === "ar"
              ? deletingAcademicYear.name_ar
              : deletingAcademicYear.name_en
            : "",
        })}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={() =>
          deletingAcademicYear && deleteMutation.mutate(deletingAcademicYear)
        }
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
