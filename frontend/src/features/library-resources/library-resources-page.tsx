"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
import { LibraryResourceForm } from "./library-resource-form";
import type { LibraryResource } from "./types";
import type { Grade } from "@/features/grades/types";
import type { Subject } from "@/features/subjects/types";

export function LibraryResourcesPage() {
  const t = useTranslations("LibraryResourcesPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can, hasRole } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canAccess = can("manage-academics") || hasRole("teacher");
  const canManageAll = can("manage-academics");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<LibraryResource | null>(null);
  const [deletingResource, setDeletingResource] = useState<LibraryResource | null>(null);
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");

  function openCreateDialog() {
    setEditingResource(null);
    setDialogOpen(true);
  }

  function openEditDialog(resource: LibraryResource) {
    setEditingResource(resource);
    setDialogOpen(true);
  }

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/library");
    }
  }, [isAuthLoading, user, router]);

  const { data: grades = [] } = useQuery({
    queryKey: ["library-resource-grades"],
    queryFn: () =>
      apiFetch<{ grades: Grade[] }>("/api/library-resources/grades").then(
        (d) => d.grades
      ),
    enabled: !isAuthLoading && !!user && canAccess,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["library-resource-subjects", gradeFilter],
    queryFn: () =>
      apiFetch<{ subjects: Subject[] }>(
        `/api/library-resources/subjects?grade_id=${gradeFilter}`
      ).then((d) => d.subjects),
    enabled: !isAuthLoading && !!user && canAccess && gradeFilter !== "all",
  });

  const queryString = new URLSearchParams({
    ...(gradeFilter !== "all" && { grade_id: gradeFilter }),
    ...(subjectFilter !== "all" && { subject_id: subjectFilter }),
  }).toString();

  const {
    data: resources = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["library-resources", gradeFilter, subjectFilter],
    queryFn: () =>
      apiFetch<{ library_resources: LibraryResource[] }>(
        `/api/library-resources${queryString ? `?${queryString}` : ""}`
      ).then((d) => d.library_resources),
    enabled: !isAuthLoading && !!user && canAccess,
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const deleteMutation = useMutation({
    mutationFn: (resource: LibraryResource) =>
      apiFetch<void>(`/api/library-resources/${resource.id}`, { method: "DELETE" }),
    onSuccess: (_data, resource) => {
      queryClient.invalidateQueries({ queryKey: ["library-resources"], exact: false });
      toast.success(t("deleteSuccess"));
      if (editingResource?.id === resource.id) setDialogOpen(false);
      setDeletingResource(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
      setDeletingResource(null);
    },
  });

  const deletingId = deleteMutation.isPending ? deleteMutation.variables?.id : undefined;

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [resources.length, isLoading],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  function canManage(resource: LibraryResource) {
    return canManageAll || resource.uploader.id === user?.id;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("heading")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
          <Button type="button" size="sm" onClick={openCreateDialog}>
            <Plus className="size-4" />
            {t("newResource")}
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Select
            items={[
              { value: "all", label: t("allGrades") },
              ...grades.map((grade) => ({
                value: String(grade.id),
                label: locale === "ar" ? grade.name_ar : grade.name_en,
              })),
            ]}
            value={gradeFilter}
            onValueChange={(value) => {
              setGradeFilter(value ?? "all");
              setSubjectFilter("all");
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allGrades")}</SelectItem>
              {grades.map((grade) => (
                <SelectItem key={grade.id} value={String(grade.id)}>
                  {locale === "ar" ? grade.name_ar : grade.name_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            items={[
              { value: "all", label: t("allSubjects") },
              ...subjects.map((subject) => ({
                value: String(subject.id),
                label: locale === "ar" ? subject.name_ar : subject.name_en,
              })),
            ]}
            value={subjectFilter}
            onValueChange={(value) => setSubjectFilter(value ?? "all")}
            disabled={gradeFilter === "all"}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allSubjects")}</SelectItem>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={String(subject.id)}>
                  {locale === "ar" ? subject.name_ar : subject.name_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isLoading && resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noResources")}</p>
        ) : (
          <div ref={rowsRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("titleColumn")}</TableHead>
                  <TableHead>{t("gradeColumn")}</TableHead>
                  <TableHead>{t("subjectsColumn")}</TableHead>
                  <TableHead>{t("uploaderColumn")}</TableHead>
                  <TableHead className="text-end">{t("actionsColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeletonRows columns={5} />
                ) : (
                  resources.map((resource) => (
                    <TableRow key={resource.id}>
                      <TableCell>{resource.title}</TableCell>
                      <TableCell>
                        {locale === "ar" ? resource.grade.name_ar : resource.grade.name_en}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {resource.subjects.map((subject) => (
                            <span
                              key={subject.id}
                              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                            >
                              {locale === "ar" ? subject.name_ar : subject.name_en}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {resource.uploader.name}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-1">
                          {resource.type === "link" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("openLink")}
                              title={t("openLink")}
                              render={
                                <a href={resource.url ?? "#"} target="_blank" rel="noreferrer" />
                              }
                            >
                              <ExternalLink className="size-4" />
                            </Button>
                          ) : (
                            resource.file && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t("download")}
                                title={t("download")}
                                render={
                                  <a
                                    href={`/api/library-resources/${resource.id}/download`}
                                    download
                                  />
                                }
                              >
                                <Download className="size-4" />
                              </Button>
                            )
                          )}
                          {canManage(resource) && (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={t("edit")}
                                title={t("edit")}
                                onClick={() => openEditDialog(resource)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={t("delete")}
                                title={t("delete")}
                                disabled={deletingId === resource.id}
                                onClick={() => setDeletingResource(resource)}
                              >
                                {deletingId === resource.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] sm:max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingResource ? t("editResource") : t("newResource")}
            </DialogTitle>
          </DialogHeader>
          <LibraryResourceForm
            key={editingResource?.id ?? "new"}
            resource={editingResource ?? undefined}
            onSuccess={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingResource}
        onOpenChange={(open) => !open && setDeletingResource(null)}
        title={t("confirmDeleteTitle")}
        description={t("confirmDeleteDescription", {
          title: deletingResource?.title ?? "",
        })}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingResource && deleteMutation.mutate(deletingResource)}
      />
    </main>
  );
}
