"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
import { ClassroomForm } from "./classroom-form";
import { ClassroomsBulkForm } from "./classrooms-bulk-form";
import type { Classroom } from "./types";
import type { Grade } from "@/features/grades/types";

export function ClassroomsPage() {
  const t = useTranslations("ClassroomsPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canManage = can("manage-academics");

  const [createOpen, setCreateOpen] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(
    null
  );

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/classrooms");
    }
  }, [isAuthLoading, user, router]);

  const {
    data: classrooms = [],
    isLoading: isLoadingClassrooms,
    error: classroomsError,
  } = useQuery({
    queryKey: ["classrooms"],
    queryFn: () =>
      apiFetch<{ classrooms: Classroom[] }>("/api/classrooms").then(
        (d) => d.classrooms
      ),
    enabled: !isAuthLoading && !!user,
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: () =>
      apiFetch<{ grades: Grade[] }>("/api/grades").then((d) => d.grades),
    enabled: !isAuthLoading && !!user,
  });

  const gradeNameById = new Map(
    grades.map((grade) => [
      grade.id,
      locale === "ar" ? grade.name_ar : grade.name_en,
    ])
  );

  useEffect(() => {
    if (!classroomsError) return;

    toast.error(
      classroomsError instanceof ApiError
        ? classroomsError.message
        : t("loadError")
    );
  }, [classroomsError, t]);

  const deleteMutation = useMutation({
    mutationFn: (classroom: Classroom) =>
      apiFetch<void>(`/api/classrooms/${classroom.id}`, { method: "DELETE" }),
    onSuccess: (_data, classroom) => {
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
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

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("classroomsHeading")}</h2>
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

        {!isLoadingClassrooms && classrooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noClassrooms")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("nameColumn")}</TableHead>
                <TableHead>{t("gradeColumn")}</TableHead>
                <TableHead>{t("capacityColumn")}</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingClassrooms ? (
                <TableSkeletonRows columns={canManage ? 4 : 3} />
              ) : (
                classrooms.map((classroom) => (
                  <TableRow key={classroom.id}>
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
