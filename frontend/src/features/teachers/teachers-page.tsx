"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
import { TeacherForm } from "./teacher-form";
import type { Teacher, TeacherStatus } from "./types";

const PER_PAGE = 10;

const statusBadgeClass: Record<TeacherStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  inactive: "bg-muted text-muted-foreground",
  on_leave: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export function TeachersPage() {
  const t = useTranslations("TeachersPage");
  const tTable = useTranslations("Table");
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canManage = can("manage-teachers");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  function openCreateDialog() {
    setEditingTeacher(null);
    setDialogOpen(true);
  }

  function openEditDialog(teacher: Teacher) {
    setEditingTeacher(teacher);
    setDialogOpen(true);
  }

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/teachers");
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
    isLoading: isLoadingTeachers,
    error: teachersError,
  } = useQuery({
    queryKey: ["teachers", page, search],
    queryFn: () =>
      apiFetch<{ teachers: Teacher[]; meta: PageMeta }>(
        `/api/teachers?page=${page}&per_page=${PER_PAGE}&search=${encodeURIComponent(search)}`
      ),
    enabled: !isAuthLoading && !!user,
  });

  const teachers = data?.teachers ?? [];
  const meta = data?.meta;

  useEffect(() => {
    if (!teachersError) return;

    toast.error(
      teachersError instanceof ApiError ? teachersError.message : t("loadError")
    );
  }, [teachersError, t]);

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
    mutationFn: (teacher: Teacher) =>
      apiFetch<void>(`/api/teachers/${teacher.id}`, { method: "DELETE" }),
    onSuccess: (_data, teacher) => {
      queryClient.invalidateQueries({ queryKey: ["teachers"], exact: false });
      toast.success(t("deleteSuccess"));
      if (editingTeacher?.id === teacher.id) setDialogOpen(false);
      setDeletingTeacher(null);
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
      apiFetch<void>("/api/teachers/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"], exact: false });
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
    setSelectedIds(checked ? new Set(teachers.map((s) => s.id)) : new Set());
  }

  const allSelected =
    teachers.length > 0 && teachers.every((s) => selectedIds.has(s.id));

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [teachers.length, page, search, isLoadingTeachers],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  const statusLabels: Record<TeacherStatus, string> = {
    active: t("statusActive"),
    inactive: t("statusInactive"),
    on_leave: t("statusOnLeave"),
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("teachersHeading")}</h2>
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
                {t("newTeacher")}
              </Button>
            )}
          </div>
        </div>

        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={t("searchPlaceholder")}
        />

        {!isLoadingTeachers && teachers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search ? t("noResults") : t("noTeachers")}
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
                  <TableHead>{t("emailColumn")}</TableHead>
                  <TableHead>{t("joiningDateColumn")}</TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingTeachers ? (
                  <TableSkeletonRows columns={canManage ? 6 : 4} />
                ) : (
                  teachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      {canManage && (
                        <TableCell>
                          <Checkbox
                            aria-label={tTable("selectRow")}
                            checked={selectedIds.has(teacher.id)}
                            onCheckedChange={(checked) =>
                              toggleRow(teacher.id, !!checked)
                            }
                          />
                        </TableCell>
                      )}
                      <TableCell>{teacher.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {teacher.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {teacher.joining_date}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[teacher.status]}`}
                        >
                          {statusLabels[teacher.status]}
                        </span>
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
                              onClick={() => openEditDialog(teacher)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon-sm"
                              aria-label={t("delete")}
                              title={t("delete")}
                              disabled={deletingId === teacher.id}
                              onClick={() => setDeletingTeacher(teacher)}
                            >
                              {deletingId === teacher.id ? (
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
              <DialogTitle>
                {editingTeacher ? t("editTeacher") : t("newTeacher")}
              </DialogTitle>
            </DialogHeader>
            <TeacherForm
              key={editingTeacher?.id ?? "new"}
              teacher={editingTeacher ?? undefined}
              onSuccess={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!deletingTeacher}
        onOpenChange={(open) => !open && setDeletingTeacher(null)}
        title={t("confirmDeleteTitle")}
        description={t("confirmDeleteDescription", {
          name: deletingTeacher?.name ?? "",
        })}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={() =>
          deletingTeacher && deleteMutation.mutate(deletingTeacher)
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
