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
import { SubjectForm } from "./subject-form";
import type { Subject } from "./types";
import type { Stage } from "@/features/stages/types";
import type { Grade } from "@/features/grades/types";

const PER_PAGE = 10;

export function SubjectsPage() {
  const t = useTranslations("SubjectsPage");
  const tTable = useTranslations("Table");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canManage = can("manage-academics");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  function openCreateDialog() {
    setEditingSubject(null);
    setDialogOpen(true);
  }

  function openEditDialog(subject: Subject) {
    setEditingSubject(subject);
    setDialogOpen(true);
  }

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/subjects");
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
    isLoading: isLoadingSubjects,
    error: subjectsError,
  } = useQuery({
    queryKey: ["subjects", page, search],
    queryFn: () =>
      apiFetch<{ subjects: Subject[]; meta: PageMeta }>(
        `/api/subjects?page=${page}&per_page=${PER_PAGE}&search=${encodeURIComponent(search)}`
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

  const stageNames = new Map(
    stages.map((s) => [s.id, locale === "ar" ? s.name_ar : s.name_en])
  );
  const gradeNames = new Map(
    grades.map((g) => [g.id, locale === "ar" ? g.name_ar : g.name_en])
  );

  function scopeLabel(subject: Subject): string {
    if (subject.stage_ids.length > 0) {
      return subject.stage_ids.map((id) => stageNames.get(id) ?? id).join(", ");
    }
    return subject.grade_ids.map((id) => gradeNames.get(id) ?? id).join(", ");
  }

  const subjects = data?.subjects ?? [];
  const meta = data?.meta;

  useEffect(() => {
    if (!subjectsError) return;

    toast.error(
      subjectsError instanceof ApiError ? subjectsError.message : t("loadError")
    );
  }, [subjectsError, t]);

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
    mutationFn: (subject: Subject) =>
      apiFetch<void>(`/api/subjects/${subject.id}`, { method: "DELETE" }),
    onSuccess: (_data, subject) => {
      queryClient.invalidateQueries({ queryKey: ["subjects"], exact: false });
      toast.success(t("deleteSuccess"));
      if (editingSubject?.id === subject.id) setDialogOpen(false);
      setDeletingSubject(null);
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
      apiFetch<void>("/api/subjects/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"], exact: false });
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
    setSelectedIds(checked ? new Set(subjects.map((s) => s.id)) : new Set());
  }

  const allSelected =
    subjects.length > 0 && subjects.every((s) => selectedIds.has(s.id));

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [subjects.length, page, search, isLoadingSubjects],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("subjectsHeading")}</h2>
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
                {t("newSubject")}
              </Button>
            )}
          </div>
        </div>

        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t("searchPlaceholder")}
        />

        {!isLoadingSubjects && subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search ? t("noResults") : t("noSubjects")}
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
                  <TableHead>{t("scopeColumn")}</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingSubjects ? (
                  <TableSkeletonRows columns={canManage ? 4 : 2} />
                ) : (
                  subjects.map((subject) => (
                    <TableRow key={subject.id}>
                      {canManage && (
                        <TableCell>
                          <Checkbox
                            aria-label={tTable("selectRow")}
                            checked={selectedIds.has(subject.id)}
                            onCheckedChange={(checked) =>
                              toggleRow(subject.id, !!checked)
                            }
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        {locale === "ar" ? subject.name_ar : subject.name_en}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {scopeLabel(subject)}
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
                              onClick={() => openEditDialog(subject)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon-sm"
                              aria-label={t("delete")}
                              title={t("delete")}
                              disabled={deletingId === subject.id}
                              onClick={() => setDeletingSubject(subject)}
                            >
                              {deletingId === subject.id ? (
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSubject ? t("editSubject") : t("newSubject")}
              </DialogTitle>
            </DialogHeader>
            <SubjectForm
              key={editingSubject?.id ?? "new"}
              subject={editingSubject ?? undefined}
              onSuccess={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!deletingSubject}
        onOpenChange={(open) => !open && setDeletingSubject(null)}
        title={t("confirmDeleteTitle")}
        description={t("confirmDeleteDescription", {
          name: deletingSubject
            ? locale === "ar"
              ? deletingSubject.name_ar
              : deletingSubject.name_en
            : "",
        })}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={() =>
          deletingSubject && deleteMutation.mutate(deletingSubject)
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
