"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClassroomsSchema, type ClassroomsFormValues } from "./schema";
import type { Classroom } from "./types";
import type { Grade } from "@/features/grades/types";

const defaultValues: ClassroomsFormValues = {
  grade_id: "",
  rows: [{ name: "", capacity: "" }],
};

// The backend validates each row as "classrooms.<index>.<field>" (it mirrors
// the request payload's shape); remap that onto this form's "rows.<index>.<field>"
// field names, and fold any per-row grade_id error onto the single shared
// grade_id field, before handing off to applyServerErrors.
function remapErrors(err: unknown): unknown {
  if (!(err instanceof ApiError) || !err.errors) return err;

  const remapped: Record<string, string[]> = {};

  for (const [field, messages] of Object.entries(err.errors)) {
    const match = field.match(/^classrooms\.(\d+)\.(name|capacity|grade_id)$/);
    if (!match) continue;

    const [, index, key] = match;
    const target = key === "grade_id" ? "grade_id" : `rows.${index}.${key}`;
    remapped[target] = messages;
  }

  return new ApiError(err.status, err.message, remapped);
}

export function ClassroomsBulkForm({ onSuccess }: { onSuccess?: () => void }) {
  const t = useTranslations("ClassroomsBulkForm");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const queryClient = useQueryClient();

  const schema = useMemo(() => createClassroomsSchema(tValidation), [tValidation]);

  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: () =>
      apiFetch<{ grades: Grade[] }>("/api/grades").then((d) => d.grades),
  });

  const form = useForm<ClassroomsFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rows",
  });

  const mutation = useMutation({
    mutationFn: (values: ClassroomsFormValues) => {
      const payload = {
        classrooms: values.rows.map((row) => ({
          grade_id: Number(values.grade_id),
          name: row.name,
          capacity: row.capacity ? Number(row.capacity) : null,
        })),
      };

      return apiFetch<{ classrooms: Classroom[] }>("/api/classrooms", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      toast.success(t("createdToast", { count: data.classrooms.length }));
      form.reset(defaultValues);
      onSuccess?.();
    },
    onError: (err) => {
      const message = applyServerErrors(
        form,
        remapErrors(err),
        [
          "grade_id",
          ...fields.map((_, i) => `rows.${i}.name` as const),
          ...fields.map((_, i) => `rows.${i}.capacity` as const),
        ],
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
                onValueChange={field.onChange}
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
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-3">
          {fields.map((rowField, index) => (
            <div key={rowField.id} className="flex items-start gap-2">
              <FormField
                control={form.control}
                name={`rows.${index}.name`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    {index === 0 && <FormLabel>{t("nameLabel")}</FormLabel>}
                    <FormControl>
                      <Input
                        {...field}
                        className="h-10"
                        placeholder={t("namePlaceholder")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`rows.${index}.capacity`}
                render={({ field }) => (
                  <FormItem className="w-28">
                    {index === 0 && <FormLabel>{t("capacityLabel")}</FormLabel>}
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        className="h-10"
                        placeholder={t("capacityPlaceholder")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                variant="outline"
                size="icon"
                className={index === 0 ? "mt-6" : undefined}
                aria-label={t("removeRow")}
                title={t("removeRow")}
                disabled={fields.length === 1}
                onClick={() => remove(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => append({ name: "", capacity: "" })}
        >
          <Plus className="size-4" />
          {t("addRow")}
        </Button>

        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {t("createClassrooms")}
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
