"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/multi-select";
import {
  createLibraryResourceSchema,
  defaultLibraryResourceValues,
  type LibraryResourceFormValues,
} from "./schema";
import type { LibraryResource } from "./types";
import type { Grade } from "@/features/grades/types";
import type { Subject } from "@/features/subjects/types";

function valuesFromResource(
  resource: LibraryResource
): LibraryResourceFormValues {
  return {
    title: resource.title,
    description: resource.description ?? "",
    type: resource.type,
    url: resource.url ?? "",
    file: undefined,
    grade_id: String(resource.grade_id),
    subject_ids: resource.subject_ids.map(String),
  };
}

const KNOWN_FIELDS = [
  "title",
  "description",
  "type",
  "url",
  "file",
  "grade_id",
  "subject_ids",
] as const;

export function LibraryResourceForm({
  resource,
  onSuccess,
}: {
  resource?: LibraryResource;
  onSuccess?: () => void;
}) {
  const t = useTranslations("LibraryResourceForm");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const queryClient = useQueryClient();

  // A file-type resource that already has a file doesn't force picking a
  // new one just to edit an unrelated field — see schema.ts's doc comment.
  const hasExistingFile = !!resource && resource.type === "file" && !!resource.file;
  const schema = useMemo(
    () => createLibraryResourceSchema(tValidation, !hasExistingFile),
    [tValidation, hasExistingFile]
  );

  const form = useForm<LibraryResourceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: resource
      ? valuesFromResource(resource)
      : defaultLibraryResourceValues,
  });

  const type = form.watch("type");
  const gradeId = form.watch("grade_id");

  // Scoped to grades/subjects the current user may actually post to (a
  // teacher can't call /api/grades or /api/subjects — see
  // LibraryResourceController::grades()/subjects()).
  const { data: grades = [] } = useQuery({
    queryKey: ["library-resource-grades"],
    queryFn: () =>
      apiFetch<{ grades: Grade[] }>("/api/library-resources/grades").then(
        (d) => d.grades
      ),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["library-resource-subjects", gradeId],
    queryFn: () =>
      apiFetch<{ subjects: Subject[] }>(
        `/api/library-resources/subjects?grade_id=${gradeId}`
      ).then((d) => d.subjects),
    enabled: !!gradeId,
  });

  const mutation = useMutation({
    mutationFn: async (values: LibraryResourceFormValues) => {
      if (!resource) {
        const formData = new FormData();
        formData.append("title", values.title);
        if (values.description) formData.append("description", values.description);
        formData.append("type", values.type);
        formData.append("grade_id", values.grade_id);
        values.subject_ids.forEach((id) => formData.append("subject_ids[]", id));
        if (values.type === "link") formData.append("url", values.url ?? "");
        if (values.type === "file" && values.file) formData.append("file", values.file);

        return apiFetch<{ library_resource: LibraryResource }>(
          "/api/library-resources",
          { method: "POST", body: formData }
        );
      }

      const updated = await apiFetch<{ library_resource: LibraryResource }>(
        `/api/library-resources/${resource.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            title: values.title,
            description: values.description || null,
            type: values.type,
            url: values.type === "link" ? values.url : null,
            grade_id: Number(values.grade_id),
            subject_ids: values.subject_ids.map(Number),
          }),
        }
      );

      if (values.type === "file" && values.file) {
        const fileData = new FormData();
        fileData.append("file", values.file);
        return apiFetch<{ library_resource: LibraryResource }>(
          `/api/library-resources/${resource.id}/file`,
          { method: "POST", body: fileData }
        );
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-resources"], exact: false });
      toast.success(resource ? t("updatedToast") : t("createdToast"));
      if (!resource) form.reset(defaultLibraryResourceValues);
      onSuccess?.();
    },
    onError: (err) => {
      const message = applyServerErrors(
        form,
        err,
        [...KNOWN_FIELDS],
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("titleLabel")}</FormLabel>
              <FormControl>
                <Input {...field} className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("descriptionLabel")}</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="grade_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("gradeLabel")}</FormLabel>
              <Select
                items={grades.map((grade) => ({
                  value: String(grade.id),
                  label: locale === "ar" ? grade.name_ar : grade.name_en,
                }))}
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  form.setValue("subject_ids", []);
                }}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("gradePlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {grades.map((grade) => (
                    <SelectItem key={grade.id} value={String(grade.id)}>
                      {locale === "ar" ? grade.name_ar : grade.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
              {grades.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("noGrades")}</p>
              )}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="subject_ids"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("subjectsLabel")}</FormLabel>
              <MultiSelect
                options={subjects.map((subject) => ({
                  value: String(subject.id),
                  label: locale === "ar" ? subject.name_ar : subject.name_en,
                }))}
                value={field.value}
                onValueChange={field.onChange}
                placeholder={t("subjectsPlaceholder")}
                disabled={!gradeId}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("typeLabel")}</FormLabel>
              <FormControl>
                <Tabs
                  value={field.value}
                  onValueChange={(value) =>
                    field.onChange(value as LibraryResourceFormValues["type"])
                  }
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="link">{t("typeLink")}</TabsTrigger>
                    <TabsTrigger value="file">{t("typeFile")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </FormControl>
            </FormItem>
          )}
        />

        {type === "link" ? (
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("urlLabel")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="url"
                    dir="ltr"
                    className="h-10"
                    placeholder={t("urlPlaceholder")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="file"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("fileLabel")}</FormLabel>
                {hasExistingFile && resource?.file && (
                  <a
                    href={resource.file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Download className="size-3.5" />
                    {resource.file.name}
                  </a>
                )}
                <FormControl>
                  <Input
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    type="file"
                    className="h-10"
                    onChange={(e) => field.onChange(e.target.files?.[0])}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">{t("fileHint")}</p>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {resource ? t("saveChanges") : t("createResource")}
          </Button>

          {onSuccess && (
            <Button type="button" variant="outline" onClick={onSuccess}>
              {t("cancel")}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
