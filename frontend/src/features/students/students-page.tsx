"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Award, Eye, Loader2, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageLoader } from "@/components/page-loader";
import { TableSkeletonRows } from "@/components/table-skeleton";
import { Pagination, type PageMeta } from "@/components/pagination";
import { SearchInput } from "@/components/search-input";
import { StudentEditForm } from "./student-edit-form";
import type { Student } from "./types";
import type { StageType, GradeType, ClassroomType } from "@/types/generated";

const PER_PAGE = 10;
const ALL = "all";

function nameOf(locale: string, item: { name_en: string; name_ar: string }) {
  return locale === "ar" ? item.name_ar : item.name_en;
}

export function StudentsPage() {
  const t = useTranslations("StudentsPage");
  const tTable = useTranslations("Table");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();

  const canManage = can("manage-students");
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);
  const [stageFilter, setStageFilter] = useState<string>(ALL);
  const [gradeFilter, setGradeFilter] = useState<string>(ALL);
  const [classroomFilter, setClassroomFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);

  function handleStageFilterChange(value: string | null) {
    setStageFilter(value ?? ALL);
    setGradeFilter(ALL);
    setClassroomFilter(ALL);
  }

  function handleGradeFilterChange(value: string | null) {
    setGradeFilter(value ?? ALL);
    setClassroomFilter(ALL);
  }

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/students");
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!isAuthLoading && user && !canManage) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, canManage, router]);

  // A search or filter change should jump back to page 1 — done here
  // (during render, comparing against the previous committed value) rather
  // than in an effect, so it takes effect in the same render instead of
  // causing an extra one. Same convention as GradesPage.
  const filtersKey = `${search}::${stageFilter}::${gradeFilter}::${classroomFilter}::${statusFilter}`;
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
  if (filtersKey !== prevFiltersKey) {
    setPrevFiltersKey(filtersKey);
    setPage(1);
    setSelectedIds(new Set());
  }

  const {
    data: studentsData,
    isLoading: isLoadingStudents,
    error: studentsError,
  } = useQuery({
    queryKey: ["students", page, search, stageFilter, gradeFilter, classroomFilter, statusFilter],
    queryFn: () =>
      apiFetch<{ students: Student[]; meta: PageMeta }>(
        `/api/students?page=${page}&per_page=${PER_PAGE}&search=${encodeURIComponent(search)}` +
          (stageFilter !== ALL ? `&stage_id=${stageFilter}` : "") +
          (gradeFilter !== ALL ? `&grade_id=${gradeFilter}` : "") +
          (classroomFilter !== ALL ? `&classroom_id=${classroomFilter}` : "") +
          `&status=${statusFilter}`
      ),
    enabled: !isAuthLoading && !!user && canManage,
  });
  const students = studentsData?.students ?? [];
  const meta = studentsData?.meta;

  const [prevMeta, setPrevMeta] = useState<PageMeta | undefined>(undefined);
  if (meta && meta !== prevMeta) {
    setPrevMeta(meta);
    if (meta.total > 0 && page > meta.last_page) {
      setPage(meta.last_page);
    }
  }

  const { data: stagesData } = useQuery({
    queryKey: ["stages"],
    queryFn: () =>
      apiFetch<{ stages: StageType[] }>("/api/stages").then((d) => d.stages),
    enabled: !isAuthLoading && !!user && canManage,
  });
  const stageNameById = new Map(
    (stagesData ?? []).map((s) => [s.id, nameOf(locale, s)])
  );

  const { data: gradesData } = useQuery({
    queryKey: ["grades"],
    queryFn: () =>
      apiFetch<{ grades: GradeType[] }>("/api/grades").then((d) => d.grades),
    enabled: !isAuthLoading && !!user && canManage,
  });
  const gradeNameById = new Map(
    (gradesData ?? []).map((g) => [g.id, nameOf(locale, g)])
  );

  const { data: classroomsData } = useQuery({
    queryKey: ["classrooms"],
    queryFn: () =>
      apiFetch<{ classrooms: ClassroomType[] }>("/api/classrooms").then(
        (d) => d.classrooms
      ),
    enabled: !isAuthLoading && !!user && canManage,
  });
  const classroomNameById = new Map(
    (classroomsData ?? []).map((c) => [c.id, c.name])
  );

  const stageFilterItems = [
    { value: ALL, label: t("allStages") },
    ...(stagesData ?? []).map((s) => ({ value: String(s.id), label: nameOf(locale, s) })),
  ];

  const gradesForFilter =
    stageFilter !== ALL
      ? (gradesData ?? []).filter((g) => g.stage_id === Number(stageFilter))
      : (gradesData ?? []);
  const gradeFilterItems = [
    { value: ALL, label: t("allGrades") },
    ...gradesForFilter.map((g) => ({ value: String(g.id), label: nameOf(locale, g) })),
  ];

  const classroomsForFilter =
    gradeFilter !== ALL
      ? (classroomsData ?? []).filter((c) => c.grade_id === Number(gradeFilter))
      : (classroomsData ?? []);
  const classroomFilterItems = [
    { value: ALL, label: t("allClassrooms") },
    ...classroomsForFilter.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  useEffect(() => {
    if (!studentsError) return;
    toast.error(
      studentsError instanceof ApiError ? studentsError.message : t("loadError")
    );
  }, [studentsError, t]);

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [
      students.length,
      page,
      search,
      stageFilter,
      gradeFilter,
      classroomFilter,
      statusFilter,
      isLoadingStudents,
    ],
  });

  const deleteMutation = useMutation({
    mutationFn: (s: Student) =>
      apiFetch<void>(`/api/students/${s.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"], exact: false });
      toast.success(t("deleteSuccess"));
      setDeletingStudent(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
    },
  });

  // One mutation backs every row's delete button — `variables` (the student
  // passed to `mutate()`) scopes the spinner to that row, same convention as
  // AcademicYearsPage.
  const deletingId = deleteMutation.isPending
    ? deleteMutation.variables?.id
    : undefined;

  function handlePageChange(newPage: number) {
    setPage(newPage);
    setSelectedIds(new Set());
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
    setSelectedIds(checked ? new Set(students.map((s) => s.id)) : new Set());
  }

  const allSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id));

  // A promotion moves everyone selected into one target classroom, so the
  // selection only makes sense when every checked row already shares a
  // classroom — mixed selections are rejected up front rather than left to
  // the promotions page to sort out.
  const selectedStudents = students.filter((s) => selectedIds.has(s.id));
  const selectedClassroomIds = new Set(selectedStudents.map((s) => s.classroom_id));

  function handlePromoteSelected() {
    if (selectedClassroomIds.size !== 1) {
      toast.error(t("promoteMixedClassrooms"));
      return;
    }
    const classroomId = [...selectedClassroomIds][0];
    router.push(
      `/promotions?classroom_id=${classroomId}&student_ids=${[...selectedIds].join(",")}`
    );
  }

  function handlePromoteClassroom() {
    router.push(`/promotions?classroom_id=${classroomFilter}`);
  }

  // Same mixed-classroom guard as handlePromoteSelected — a graduation also
  // moves everyone selected as one batch out of one classroom.
  function handleGraduateSelected() {
    if (selectedClassroomIds.size !== 1) {
      toast.error(t("promoteMixedClassrooms"));
      return;
    }
    const classroomId = [...selectedClassroomIds][0];
    router.push(
      `/graduations?classroom_id=${classroomId}&student_ids=${[...selectedIds].join(",")}`
    );
  }

  function handleGraduateClassroom() {
    router.push(`/graduations?classroom_id=${classroomFilter}`);
  }

  if (isAuthLoading || !user || !canManage) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t("indexHeading")}</h1>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && statusFilter === "active" && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePromoteSelected}
              >
                <TrendingUp className="size-4" />
                {t("promoteSelected", { count: selectedIds.size })}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGraduateSelected}
              >
                <Award className="size-4" />
                {t("graduateSelected", { count: selectedIds.size })}
              </Button>
            </>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => router.push("/students/new")}
          >
            <Plus className="size-4" />
            {t("newStudent")}
          </Button>
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
          onValueChange={handleGradeFilterChange}
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
        <Select
          items={classroomFilterItems}
          value={classroomFilter}
          onValueChange={(value) => setClassroomFilter(value ?? ALL)}
        >
          <SelectTrigger aria-label={t("classroomFilterLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {classroomFilterItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={[
            { value: "active", label: t("activeBadge") },
            { value: "graduated", label: t("graduatedBadge") },
            { value: "all", label: t("allStatuses") },
          ]}
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value ?? "active")}
        >
          <SelectTrigger aria-label={t("statusFilterLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t("activeBadge")}</SelectItem>
            <SelectItem value="graduated">{t("graduatedBadge")}</SelectItem>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
          </SelectContent>
        </Select>
        {classroomFilter !== ALL && statusFilter === "active" && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePromoteClassroom}
            >
              <TrendingUp className="size-4" />
              {t("promoteClassroom")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGraduateClassroom}
            >
              <Award className="size-4" />
              {t("graduateClassroom")}
            </Button>
          </>
        )}
      </div>

      {!isLoadingStudents && students.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search ||
          stageFilter !== ALL ||
          gradeFilter !== ALL ||
          classroomFilter !== ALL ||
          statusFilter !== "active"
            ? t("noResults")
            : t("noStudents")}
        </p>
      ) : (
        <div ref={rowsRef}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label={tTable("selectAll")}
                    checked={allSelected}
                    onCheckedChange={(checked) => toggleAll(!!checked)}
                  />
                </TableHead>
                <TableHead>{t("nameColumn")}</TableHead>
                <TableHead>{t("emailColumn")}</TableHead>
                <TableHead>{t("classColumn")}</TableHead>
                <TableHead>{t("parentEmailColumn")}</TableHead>
                {statusFilter !== "active" && <TableHead>{t("statusColumn")}</TableHead>}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingStudents ? (
                <TableSkeletonRows columns={statusFilter !== "active" ? 7 : 6} />
              ) : (
                students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <Checkbox
                        aria-label={tTable("selectRow")}
                        checked={selectedIds.has(student.id)}
                        onCheckedChange={(checked) =>
                          toggleRow(student.id, !!checked)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {locale === "ar" ? student.name_ar : student.name_en}
                    </TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>
                      {stageNameById.get(student.stage_id) ?? "—"}
                      {" / "}
                      {gradeNameById.get(student.grade_id) ?? "—"}
                      {" / "}
                      {classroomNameById.get(student.classroom_id) ?? "—"}
                    </TableCell>
                    <TableCell>{student.parent_email}</TableCell>
                    {statusFilter !== "active" && (
                      <TableCell>
                        {student.status === "graduated" ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {t("graduatedBadge")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            {t("activeBadge")}
                          </span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={t("view")}
                          title={t("view")}
                          onClick={() => router.push(`/students/${student.id}`)}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={t("edit")}
                          title={t("edit")}
                          onClick={() => setEditingStudent(student)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          aria-label={t("delete")}
                          title={t("delete")}
                          disabled={deletingId === student.id}
                          onClick={() => setDeletingStudent(student)}
                        >
                          {deletingId === student.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {meta && <Pagination meta={meta} onPageChange={handlePageChange} />}

      <Dialog
        open={!!editingStudent}
        onOpenChange={(open) => !open && setEditingStudent(null)}
      >
        <DialogContent className="max-h-[85vh] sm:max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("editStudent")}</DialogTitle>
          </DialogHeader>
          {editingStudent && (
            <StudentEditForm
              key={editingStudent.id}
              student={editingStudent}
              onSuccess={() => setEditingStudent(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingStudent}
        onOpenChange={(open) => !open && setDeletingStudent(null)}
        title={t("confirmDeleteTitle")}
        description={t("confirmDeleteDescription", {
          name: deletingStudent
            ? locale === "ar"
              ? deletingStudent.name_ar
              : deletingStudent.name_en
            : "",
        })}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingStudent && deleteMutation.mutate(deletingStudent)}
      />
    </main>
  );
}
