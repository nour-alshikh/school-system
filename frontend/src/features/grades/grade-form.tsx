"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import { cn } from "@/lib/utils";
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
import { LocaleTabs } from "@/components/locale-tabs";
import { createGradeSchema, type GradeFormValues } from "./schema";
import type { Grade } from "./types";
import type { Stage } from "@/features/stages/types";

const defaultValues: GradeFormValues = {
  stage_id: "",
  name_en: "",
  name_ar: "",
};

function valuesFromGrade(grade: Grade): GradeFormValues {
  return {
    stage_id: String(grade.stage_id),
    name_en: grade.name_en,
    name_ar: grade.name_ar,
  };
}

export function GradeForm({
  grade,
  onSuccess,
}: {
  grade?: Grade;
  onSuccess?: () => void;
}) {
  const t = useTranslations("GradeForm");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [activeLocale, setActiveLocale] = useState<"en" | "ar">("en");

  const schema = useMemo(() => createGradeSchema(tValidation), [tValidation]);

  const { data: stages = [] } = useQuery({
    queryKey: ["stages"],
    queryFn: () =>
      apiFetch<{ stages: Stage[] }>("/api/stages").then((d) => d.stages),
  });

  const form = useForm<GradeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: grade ? valuesFromGrade(grade) : defaultValues,
  });

  const mutation = useMutation({
    mutationFn: (values: GradeFormValues) => {
      const payload = {
        stage_id: Number(values.stage_id),
        name: { en: values.name_en, ar: values.name_ar },
      };

      return grade
        ? apiFetch<{ grade: Grade }>(`/api/grades/${grade.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : apiFetch<{ grade: Grade }>("/api/grades", {
            method: "POST",
            body: JSON.stringify(payload),
          });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      toast.success(grade ? t("updatedToast") : t("createdToast"));
      if (!grade) form.reset(defaultValues);
      onSuccess?.();
    },
    onError: (err) => {
      // The backend validates the nested "name.en"/"name.ar" keys (they
      // mirror the request payload's shape); remap them to this form's flat
      // field names before handing off to applyServerErrors.
      const remapped =
        err instanceof ApiError && err.errors
          ? new ApiError(err.status, err.message, {
              ...(err.errors["name.en"] && { name_en: err.errors["name.en"] }),
              ...(err.errors["name.ar"] && { name_ar: err.errors["name.ar"] }),
              ...(err.errors["stage_id"] && { stage_id: err.errors["stage_id"] }),
            })
          : err;

      const message = applyServerErrors(
        form,
        remapped,
        ["stage_id", "name_en", "name_ar"],
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(
          (values) => mutation.mutate(values),
          // A hidden tab's own error would otherwise render invisibly —
          // jump to whichever locale actually failed validation.
          (errors) => {
            if (errors.name_en && activeLocale !== "en") setActiveLocale("en");
            else if (errors.name_ar && activeLocale !== "ar") setActiveLocale("ar");
          }
        )}
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="stage_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("stageLabel")}</FormLabel>
              <Select
                items={stages.map((stage) => ({
                  value: String(stage.id),
                  label: locale === "ar" ? stage.name_ar : stage.name_en,
                }))}
                value={field.value}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("stagePlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={String(stage.id)}>
                      {locale === "ar" ? stage.name_ar : stage.name_en}
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
          name="name_en"
          render={({ field }) => (
            <FormItem className={cn(activeLocale !== "en" && "hidden")}>
              <div className="flex items-center justify-between">
                <FormLabel>{t("nameEnLabel")}</FormLabel>
                <LocaleTabs
                  value={activeLocale}
                  translate={{ en: "name_en", ar: "name_ar", what: "grade name" }}
                  onChange={setActiveLocale}
                  errors={{
                    en: !!form.formState.errors.name_en,
                    ar: !!form.formState.errors.name_ar,
                  }}
                />
              </div>
              <FormControl>
                <Input {...field} dir="ltr" className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name_ar"
          render={({ field }) => (
            <FormItem className={cn(activeLocale !== "ar" && "hidden")}>
              <div className="flex items-center justify-between">
                <FormLabel>{t("nameArLabel")}</FormLabel>
                <LocaleTabs
                  value={activeLocale}
                  translate={{ en: "name_en", ar: "name_ar", what: "grade name" }}
                  onChange={setActiveLocale}
                  errors={{
                    en: !!form.formState.errors.name_en,
                    ar: !!form.formState.errors.name_ar,
                  }}
                />
              </div>
              <FormControl>
                <Input {...field} dir="rtl" className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {grade ? t("saveChanges") : t("createGrade")}
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
