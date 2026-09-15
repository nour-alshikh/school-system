"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Loader2, Pencil, Trash2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useFadeIn } from "@/hooks/use-fade-in";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/table-skeleton";
import { Pagination, type PageMeta } from "@/components/pagination";
import type { Classroom } from "./types";
import type { Stage } from "@/features/stages/types";

const PER_PAGE = 10;

export function ClassroomStageSection({
  stage,
  search,
  canManage,
  gradeNameById,
  onEdit,
}: {
  stage: Stage;
  search: string;
  canManage: boolean;
  gradeNameById: Map<number, string>;
  onEdit: (classroom: Classroom) => void;
}) {
  const t = useTranslations("ClassroomsPage");
  const tTable = useTranslations("Table");
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deletingClassroom, setDeletingClassroom] = useState<Classroom | null>(
    null
  );
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  // A search change should jump this section back to page 1 and drop any
  // selection made on the previous result set — done here (during render,
  // comparing against the previous committed value) rather than in an
  // effect, so it takes effect in the same render instead of causing an
  // extra one.
  const [prevSearch, setPrevSearch] = useState(search);
  if (search !== prevSearch) {
    setPrevSearch(search);
    setPage(1);
    setSelectedIds(new Set());
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["classrooms", "stage", stage.id, page, search],
    queryFn: () =>
      apiFetch<{ classrooms: Classroom[]; meta: PageMeta }>(
        `/api/classrooms?stage_id=${stage.id}&page=${page}&per_page=${PER_PAGE}&search=${encodeURIComponent(search)}`
      ),
    enabled: isOpen,
  });

  const classrooms = data?.classrooms ?? [];
  const meta = data?.meta;

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
    mutationFn: (classroom: Classroom) =>
      apiFetch<void>(`/api/classrooms/${classroom.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["classrooms"],
        exact: false,
      });
      toast.success(t("deleteSuccess"));
      setDeletingClassroom(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
    },
  });

  // One mutation backs every row's delete button, so `isPending` alone can't
  // tell which row is in flight — `variables` (the classroom passed to
  // `mutate()`) does, letting only that row disable/spin instead of freezing
  // the whole table.
  const deletingId = deleteMutation.isPending
    ? deleteMutation.variables?.id
    : undefined;

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) =>
      apiFetch<void>("/api/classrooms/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["classrooms"],
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
      checked ? new Set(classrooms.map((c) => c.id)) : new Set()
    );
  }

  const allSelected =
    classrooms.length > 0 && classrooms.every((c) => selectedIds.has(c.id));

  const contentRef = useFadeIn<HTMLDivElement>({ y: -8, deps: [isOpen] });
  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [classrooms.length, page, search, isLoading],
  });

  return (
    <div data-animate="stage-section" className="rounded-lg border">
      <Button
        type="button"
        variant="ghost"
        className="w-full justify-between rounded-lg px-4"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{locale === "ar" ? stage.name_ar : stage.name_en}</span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </Button>

      {isOpen && (
        <div ref={contentRef} className="flex flex-col gap-4 border-t p-4">
          {error ? (
            <p className="text-sm text-destructive">
              {error instanceof ApiError ? error.message : t("loadError")}
            </p>
          ) : (
            <>
              {canManage && selectedIds.size > 0 && (
                <div>
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
                </div>
              )}

              {!isLoading && classrooms.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {search ? t("noResults") : t("noClassrooms")}
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
                        <TableHead>{t("gradeColumn")}</TableHead>
                        <TableHead>{t("capacityColumn")}</TableHead>
                        {canManage && <TableHead />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableSkeletonRows columns={canManage ? 5 : 3} />
                      ) : (
                        classrooms.map((classroom) => (
                          <TableRow key={classroom.id}>
                            {canManage && (
                              <TableCell>
                                <Checkbox
                                  aria-label={tTable("selectRow")}
                                  checked={selectedIds.has(classroom.id)}
                                  onCheckedChange={(checked) =>
                                    toggleRow(classroom.id, checked)
                                  }
                                />
                              </TableCell>
                            )}
                            <TableCell>{classroom.name}</TableCell>
                            <TableCell>
                              {gradeNameById.get(classroom.grade_id) ?? "—"}
                            </TableCell>
                            <TableCell>{classroom.capacity ?? "—"}</TableCell>
                            {canManage && (
                              <TableCell>
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon-sm"
                                    aria-label={t("edit")}
                                    title={t("edit")}
                                    onClick={() => onEdit(classroom)}
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon-sm"
                                    aria-label={t("delete")}
                                    title={t("delete")}
                                    disabled={deletingId === classroom.id}
                                    onClick={() =>
                                      setDeletingClassroom(classroom)
                                    }
                                  >
                                    {deletingId === classroom.id ? (
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

              {meta && (
                <Pagination meta={meta} onPageChange={handlePageChange} />
              )}
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deletingClassroom}
        onOpenChange={(open) => !open && setDeletingClassroom(null)}
        title={t("confirmDeleteTitle")}
        description={t("confirmDeleteDescription", {
          name: deletingClassroom?.name ?? "",
        })}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={() =>
          deletingClassroom && deleteMutation.mutate(deletingClassroom)
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
    </div>
  );
}
