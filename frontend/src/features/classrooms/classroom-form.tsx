"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createClassroomEditSchema,
  type ClassroomEditFormValues,
} from "./schema";
import type { Classroom } from "./types";
import type { Grade } from "@/features/grades/types";

function valuesFromClassroom(classroom: Classroom): ClassroomEditFormValues {
  return {
    grade_id: String(classroom.grade_id),
    name: classroom.name,
    capacity: classroom.capacity != null ? String(classroom.capacity) : "",
  };
}

export function ClassroomForm({
  classroom,
  onSuccess,
}: {
  classroom: Classroom;
  onSuccess?: () => void;
}) {
  const t = useTranslations("ClassroomForm");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const queryClient = useQueryClient();

  const schema = useMemo(
    () => createClassroomEditSchema(tValidation),
    [tValidation]
  );

  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: () =>
      apiFetch<{ grades: Grade[] }>("/api/grades").then((d) => d.grades),
  });

  const form = useForm<ClassroomEditFormValues>({
    resolver: zodResolver(schema),
    defaultValues: valuesFromClassroom(classroom),
  });

  const mutation = useMutation({
    mutationFn: (values: ClassroomEditFormValues) => {
      const payload = {
        grade_id: Number(values.grade_id),
        name: values.name,
        capacity: values.capacity ? Number(values.capacity) : null,
      };

      return apiFetch<{ classroom: Classroom }>(
        `/api/classrooms/${classroom.id}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      toast.success(t("updatedToast"));
      onSuccess?.();
    },
    onError: (err) => {
      const message = applyServerErrors(
        form,
        err,
        ["grade_id", "name", "capacity"],
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

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("nameLabel")}</FormLabel>
              <FormControl>
                <Input {...field} className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="capacity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("capacityLabel")}</FormLabel>
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

        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {t("saveChanges")}
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
