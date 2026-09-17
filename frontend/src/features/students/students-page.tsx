"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function nameOf(locale: string, item: { name_en: string; name_ar: string }) {
  return locale === "ar" ? item.name_ar : item.name_en;
}

export function StudentsPage() {
  const t = useTranslations("StudentsPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();

  const canManage = can("manage-students");
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [page, setPage] = useState(1);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);

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

  const [prevSearch, setPrevSearch] = useState(search);
  if (search !== prevSearch) {
    setPrevSearch(search);
    setPage(1);
  }

  const {
    data: studentsData,
    isLoading: isLoadingStudents,
    error: studentsError,
  } = useQuery({
    queryKey: ["students", page, search],
    queryFn: () =>
      apiFetch<{ students: Student[]; meta: PageMeta }>(
        `/api/students?page=${page}&per_page=${PER_PAGE}&search=${encodeURIComponent(search)}`
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

  useEffect(() => {
    if (!studentsError) return;
    toast.error(
      studentsError instanceof ApiError ? studentsError.message : t("loadError")
    );
  }, [studentsError, t]);

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [students.length, page, search, isLoadingStudents],
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
  }

  if (isAuthLoading || !user || !canManage) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t("indexHeading")}</h1>
        <Button
          type="button"
          size="sm"
          onClick={() => router.push("/students/new")}
        >
          <Plus className="size-4" />
          {t("newStudent")}
        </Button>
      </div>

      <SearchInput
        value={searchInput}
        onChange={setSearchInput}
        placeholder={t("searchPlaceholder")}
      />

      {!isLoadingStudents && students.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search ? t("noResults") : t("noStudents")}
        </p>
      ) : (
        <div ref={rowsRef}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("nameColumn")}</TableHead>
                <TableHead>{t("emailColumn")}</TableHead>
                <TableHead>{t("classColumn")}</TableHead>
                <TableHead>{t("parentEmailColumn")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingStudents ? (
                <TableSkeletonRows columns={5} />
              ) : (
                students.map((student) => (
                  <TableRow key={student.id}>
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
