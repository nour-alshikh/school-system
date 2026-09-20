"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
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
import { ChargeAllFeeForm } from "@/features/fee-charges/charge-all-fee-form";
import { FeeForm } from "./fee-form";
import type { Fee } from "./types";
import type { AcademicYear } from "@/features/academic-years/types";
import type { Stage } from "@/features/stages/types";
import type { Grade } from "@/features/grades/types";

const PER_PAGE = 10;

const statusBadgeClass: Record<"active" | "inactive", string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  inactive: "bg-muted text-muted-foreground",
};

export function FeesPage() {
  const t = useTranslations("FeesPage");
  const tTable = useTranslations("Table");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canManage = can("manage-fees");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingFee, setDeletingFee] = useState<Fee | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [chargingAllFee, setChargingAllFee] = useState<Fee | null>(null);

  function openCreateDialog() {
    setEditingFee(null);
    setDialogOpen(true);
  }

  function openEditDialog(fee: Fee) {
    setEditingFee(fee);
    setDialogOpen(true);
  }

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/fees");
    }
  }, [isAuthLoading, user, router]);

  const [prevSearch, setPrevSearch] = useState(search);
  if (search !== prevSearch) {
    setPrevSearch(search);
    setPage(1);
    setSelectedIds(new Set());
  }

  const {
    data,
    isLoading: isLoadingFees,
    error: feesError,
  } = useQuery({
    queryKey: ["fees", page, search],
    queryFn: () =>
      apiFetch<{ fees: Fee[]; meta: PageMeta }>(
        `/api/fees?page=${page}&per_page=${PER_PAGE}&search=${encodeURIComponent(search)}`
      ),
    enabled: !isAuthLoading && !!user,
  });

  const { data: academicYears = [] } = useQuery({
    queryKey: ["academic-years-all"],
    queryFn: () =>
      apiFetch<{ academic_years: AcademicYear[] }>("/api/academic-years").then(
        (d) => d.academic_years
      ),
    enabled: !isAuthLoading && !!user,
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["stages"],
    queryFn: () =>
      apiFetch<{ stages: Stage[] }>("/api/stages").then((d) => d.stages),
    enabled: !isAuthLoading && !!user,
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: () =>
      apiFetch<{ grades: Grade[] }>("/api/grades").then((d) => d.grades),
    enabled: !isAuthLoading && !!user,
  });

  const academicYearNames = new Map(
    academicYears.map((y) => [y.id, String(y.year)])
  );
  const stageNames = new Map(
    stages.map((s) => [s.id, locale === "ar" ? s.name_ar : s.name_en])
  );
  const gradeNames = new Map(
    grades.map((g) => [g.id, locale === "ar" ? g.name_ar : g.name_en])
  );

  function scopeLabel(fee: Fee): string {
    if (fee.is_for_all) return t("scopeAllStudents");
    const stage = fee.stage_id ? stageNames.get(fee.stage_id) : undefined;
    const grade = fee.grade_id ? gradeNames.get(fee.grade_id) : undefined;
    return [grade, stage].filter(Boolean).join(" / ");
  }

  const fees = data?.fees ?? [];
  const meta = data?.meta;

  useEffect(() => {
    if (!feesError) return;

    toast.error(feesError instanceof ApiError ? feesError.message : t("loadError"));
  }, [feesError, t]);

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
    mutationFn: (fee: Fee) =>
      apiFetch<void>(`/api/fees/${fee.id}`, { method: "DELETE" }),
    onSuccess: (_data, fee) => {
      queryClient.invalidateQueries({ queryKey: ["fees"], exact: false });
      toast.success(t("deleteSuccess"));
      if (editingFee?.id === fee.id) setDialogOpen(false);
      setDeletingFee(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
    },
  });

  const deletingId = deleteMutation.isPending
    ? deleteMutation.variables?.id
    : undefined;

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) =>
      apiFetch<void>("/api/fees/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"], exact: false });
      toast.success(t("bulkDeleteSuccess"));
      setSelectedIds(new Set());
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("bulkDeleteError"));
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
    setSelectedIds(checked ? new Set(fees.map((f) => f.id)) : new Set());
  }

  const allSelected = fees.length > 0 && fees.every((f) => selectedIds.has(f.id));

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [fees.length, page, search, isLoadingFees],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("feesHeading")}</h2>
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
                {t("newFee")}
              </Button>
            )}
          </div>
        </div>

        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t("searchPlaceholder")}
        />

        {!isLoadingFees && fees.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search ? t("noResults") : t("noFees")}
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
                  <TableHead>{t("academicYearColumn")}</TableHead>
                  <TableHead>{t("amountColumn")}</TableHead>
                  <TableHead>{t("scopeColumn")}</TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingFees ? (
                  <TableSkeletonRows columns={canManage ? 7 : 5} />
                ) : (
                  fees.map((fee) => (
                    <TableRow key={fee.id}>
                      {canManage && (
                        <TableCell>
                          <Checkbox
                            aria-label={tTable("selectRow")}
                            checked={selectedIds.has(fee.id)}
                            onCheckedChange={(checked) =>
                              toggleRow(fee.id, !!checked)
                            }
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        {locale === "ar" ? fee.name_ar : fee.name_en}
                      </TableCell>
                      <TableCell>
                        {academicYearNames.get(fee.academic_year_id) ?? "—"}
                      </TableCell>
                      <TableCell>{Number(fee.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {scopeLabel(fee)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[fee.is_active ? "active" : "inactive"]}`}
                        >
                          {fee.is_active ? t("statusActive") : t("statusInactive")}
                        </span>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              aria-label={t("chargeAll")}
                              title={t("chargeAll")}
                              onClick={() => setChargingAllFee(fee)}
                            >
                              <Users className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              aria-label={t("edit")}
                              title={t("edit")}
                              onClick={() => openEditDialog(fee)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon-sm"
                              aria-label={t("delete")}
                              title={t("delete")}
                              disabled={deletingId === fee.id}
                              onClick={() => setDeletingFee(fee)}
                            >
                              {deletingId === fee.id ? (
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
          <DialogContent className="max-h-[85vh] sm:max-w-xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingFee ? t("editFee") : t("newFee")}</DialogTitle>
            </DialogHeader>
            <FeeForm
              key={editingFee?.id ?? "new"}
              fee={editingFee ?? undefined}
              onSuccess={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={!!chargingAllFee}
        onOpenChange={(open) => !open && setChargingAllFee(null)}
      >
        <DialogContent className="max-h-[85vh] sm:max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("chargeAll")}</DialogTitle>
          </DialogHeader>
          {chargingAllFee && (
            <ChargeAllFeeForm
              key={chargingAllFee.id}
              fee={chargingAllFee}
              onSuccess={() => setChargingAllFee(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingFee}
        onOpenChange={(open) => !open && setDeletingFee(null)}
        title={t("confirmDeleteTitle")}
        description={t("confirmDeleteDescription", {
          name: deletingFee
            ? locale === "ar"
              ? deletingFee.name_ar
              : deletingFee.name_en
            : "",
        })}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingFee && deleteMutation.mutate(deletingFee)}
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
