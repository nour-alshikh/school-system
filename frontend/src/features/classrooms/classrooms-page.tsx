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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ClassroomForm } from "./classroom-form";
import { ClassroomsBulkForm } from "./classrooms-bulk-form";
import type { Classroom } from "./types";
import type { Grade } from "@/features/grades/types";
import type { Stage } from "@/features/stages/types";

const PER_PAGE = 10;
const ALL_STAGES = "all";
const ALL_GRADES = "all";

export function ClassroomsPage() {
  const t = useTranslations("ClassroomsPage");
  const tTable = useTranslations("Table");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canManage = can("manage-academics");

  const [createOpen, setCreateOpen] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(
    null
  );
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [stageFilter, setStageFilter] = useState<string>(ALL_STAGES);
  const [gradeFilter, setGradeFilter] = useState<string>(ALL_GRADES);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/classrooms");
    }
  }, [isAuthLoading, user, router]);

  // A search or filter change should jump back to page 1 and drop any
  // selection made on the previous result set — done here (during render,
  // comparing against the previous committed value) rather than in an
  // effect, so it takes effect in the same render instead of causing an
  // extra one.
  const filtersKey = JSON.stringify([search, stageFilter, gradeFilter]);
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
  if (filtersKey !== prevFiltersKey) {
    setPrevFiltersKey(filtersKey);
    setPage(1);
    setSelectedIds(new Set());
  }

  // Narrowing the stage would otherwise leave a grade selected that no
  // longer belongs to it.
  function handleStageFilterChange(value: string | null) {
    setStageFilter(value ?? ALL_STAGES);
    setGradeFilter(ALL_GRADES);
  }

  const {
    data,
    isLoading: isLoadingClassrooms,
    error: classroomsError,
  } = useQuery({
    queryKey: ["classrooms", page, search, stageFilter, gradeFilter],
    queryFn: () =>
      apiFetch<{ classrooms: Classroom[]; meta: PageMeta }>(
        `/api/classrooms?page=${page}&per_page=${PER_PAGE}&search=${encodeURIComponent(search)}` +
          (gradeFilter !== ALL_GRADES
            ? `&grade_id=${gradeFilter}`
            : stageFilter !== ALL_STAGES
              ? `&stage_id=${stageFilter}`
              : "")
      ),
    enabled: !isAuthLoading && !!user,
  });

  const classrooms = data?.classrooms ?? [];
  const meta = data?.meta;

  const { data: grades = [] } = useQuery({
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

  const gradeNameById = new Map(
    grades.map((grade) => [
      grade.id,
      locale === "ar" ? grade.name_ar : grade.name_en,
    ])
  );

  const stageFilterItems = [
    { value: ALL_STAGES, label: t("allStages") },
    ...stages.map((stage) => ({
      value: String(stage.id),
      label: locale === "ar" ? stage.name_ar : stage.name_en,
    })),
  ];

  const gradesForFilter =
    stageFilter === ALL_STAGES
      ? grades
      : grades.filter((grade) => String(grade.stage_id) === stageFilter);

  const gradeFilterItems = [
    { value: ALL_GRADES, label: t("allGrades") },
    ...gradesForFilter.map((grade) => ({
      value: String(grade.id),
      label: locale === "ar" ? grade.name_ar : grade.name_en,
    })),
  ];

  useEffect(() => {
    if (!classroomsError) return;

    toast.error(
      classroomsError instanceof ApiError
        ? classroomsError.message
        : t("loadError")
    );
  }, [classroomsError, t]);

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
    onSuccess: (_data, classroom) => {
      queryClient.invalidateQueries({
        queryKey: ["classrooms"],
        exact: false,
      });
      toast.success(t("deleteSuccess"));
      if (editingClassroom?.id === classroom.id) setEditingClassroom(null);
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
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(t("confirmBulkDelete", { count: ids.length }))) {
      return;
    }
    bulkDeleteMutation.mutate(ids);
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

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("classroomsHeading")}</h2>
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
              <Button
                type="button"
                size="sm"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4" />
                {t("newClassrooms")}
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
            onValueChange={handleStageFilterChange}
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
          <Select
            items={gradeFilterItems}
            value={gradeFilter}
            onValueChange={(value) => setGradeFilter(value ?? ALL_GRADES)}
          >
            <SelectTrigger aria-label={t("gradeFilterLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gradeFilterItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isLoadingClassrooms && classrooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search || stageFilter !== ALL_STAGES || gradeFilter !== ALL_GRADES
              ? t("noResults")
              : t("noClassrooms")}
          </p>
        ) : (
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
              {isLoadingClassrooms ? (
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
                            onClick={() => setEditingClassroom(classroom)}
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
                            onClick={() => deleteMutation.mutate(classroom)}
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
        )}

        {meta && <Pagination meta={meta} onPageChange={handlePageChange} />}
      </section>

      {canManage && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("newClassrooms")}</DialogTitle>
            </DialogHeader>
            <ClassroomsBulkForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      )}

      {canManage && (
        <Dialog
          open={!!editingClassroom}
          onOpenChange={(open) => !open && setEditingClassroom(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("editClassroom")}</DialogTitle>
            </DialogHeader>
            {editingClassroom && (
              <ClassroomForm
                key={editingClassroom.id}
                classroom={editingClassroom}
                onSuccess={() => setEditingClassroom(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}
