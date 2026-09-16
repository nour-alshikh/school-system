"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useStaggerIn } from "@/hooks/use-stagger-in";
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
import { MultiSelect } from "@/components/multi-select";
import type { Teacher } from "@/features/teachers/types";
import type { Subject } from "@/features/subjects/types";

export function TeacherSubjectsPage() {
  const t = useTranslations("TeacherSubjectsPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canManage = can("manage-teachers");

  const [assigningTeacher, setAssigningTeacher] = useState<Teacher | null>(
    null
  );
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/teacher-subjects");
    }
  }, [isAuthLoading, user, router]);

  const {
    data: teachers = [],
    isLoading: isLoadingTeachers,
    error: teachersError,
  } = useQuery({
    queryKey: ["teachers", "all"],
    queryFn: () =>
      apiFetch<{ teachers: Teacher[] }>("/api/teachers").then(
        (d) => d.teachers
      ),
    enabled: !isAuthLoading && !!user,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects", "all"],
    queryFn: () =>
      apiFetch<{ subjects: Subject[] }>("/api/subjects").then(
        (d) => d.subjects
      ),
    enabled: !isAuthLoading && !!user,
  });

  useEffect(() => {
    if (!teachersError) return;

    toast.error(
      teachersError instanceof ApiError ? teachersError.message : t("loadError")
    );
  }, [teachersError, t]);

  const subjectNames = new Map(
    subjects.map((subject) => [
      subject.id,
      locale === "ar" ? subject.name_ar : subject.name_en,
    ])
  );

  function openAssignDialog(teacher: Teacher) {
    setAssigningTeacher(teacher);
    setSelectedSubjectIds(teacher.subject_ids.map(String));
  }

  const mutation = useMutation({
    mutationFn: (teacher: Teacher) =>
      apiFetch<{ teacher: Teacher }>(`/api/teachers/${teacher.id}/subjects`, {
        method: "PUT",
        body: JSON.stringify({
          subject_ids: selectedSubjectIds.map(Number),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"], exact: false });
      toast.success(t("updatedToast"));
      setAssigningTeacher(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("updateError"));
    },
  });

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [teachers.length, isLoadingTeachers],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>

        {!isLoadingTeachers && teachers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noTeachers")}</p>
        ) : (
          <div ref={rowsRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("teacherColumn")}</TableHead>
                  <TableHead>{t("subjectsColumn")}</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingTeachers ? (
                  <TableSkeletonRows columns={canManage ? 3 : 2} />
                ) : (
                  teachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell>{teacher.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {teacher.subject_ids.length > 0
                          ? teacher.subject_ids
                              .map((id) => subjectNames.get(id) ?? id)
                              .join(", ")
                          : t("noSubjectsAssigned")}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              aria-label={t("assign")}
                              title={t("assign")}
                              onClick={() => openAssignDialog(teacher)}
                            >
                              <Pencil className="size-4" />
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
      </section>

      {canManage && (
        <Dialog
          open={!!assigningTeacher}
          onOpenChange={(open) => !open && setAssigningTeacher(null)}
        >
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {t("assignDialogTitle", { name: assigningTeacher?.name ?? "" })}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <MultiSelect
                options={subjects.map((subject) => ({
                  value: String(subject.id),
                  label:
                    locale === "ar" ? subject.name_ar : subject.name_en,
                }))}
                value={selectedSubjectIds}
                onValueChange={setSelectedSubjectIds}
                placeholder={t("subjectsPlaceholder")}
              />

              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() =>
                    assigningTeacher && mutation.mutate(assigningTeacher)
                  }
                >
                  {mutation.isPending && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {t("save")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAssigningTeacher(null)}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}
