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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiSelect } from "@/components/multi-select";
import { LocaleTabs } from "@/components/locale-tabs";
import {
  createSubjectSchema,
  type SubjectFormValues,
  type SubjectScopeType,
} from "./schema";
import type { Subject } from "./types";
import type { Stage } from "@/features/stages/types";
import type { Grade } from "@/features/grades/types";

const defaultValues: SubjectFormValues = {
  name_en: "",
  name_ar: "",
  scope_type: "stage",
  stage_ids: [],
  grade_ids: [],
};

function valuesFromSubject(subject: Subject): SubjectFormValues {
  // A subject only ever has one non-empty side (backend enforces it) — the
  // toggle just needs to land on whichever one that is, defaulting to
  // "stage" for a brand-new subject with neither set yet.
  const scopeType: SubjectScopeType =
    subject.grade_ids.length > 0 && subject.stage_ids.length === 0
      ? "grade"
      : "stage";

  return {
    name_en: subject.name_en,
    name_ar: subject.name_ar,
    scope_type: scopeType,
    stage_ids: subject.stage_ids.map(String),
    grade_ids: subject.grade_ids.map(String),
  };
}

export function SubjectForm({
  subject,
  onSuccess,
}: {
  subject?: Subject;
  onSuccess?: () => void;
}) {
  const t = useTranslations("SubjectForm");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [activeLocale, setActiveLocale] = useState<"en" | "ar">("en");

  const schema = useMemo(() => createSubjectSchema(tValidation), [tValidation]);

  const { data: stages = [] } = useQuery({
    queryKey: ["stages"],
    queryFn: () =>
      apiFetch<{ stages: Stage[] }>("/api/stages").then((d) => d.stages),
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: () =>
      apiFetch<{ grades: Grade[] }>("/api/grades").then((d) => d.grades),
  });

  const form = useForm<SubjectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: subject ? valuesFromSubject(subject) : defaultValues,
  });

  const scopeType = form.watch("scope_type");

  const mutation = useMutation({
    mutationFn: (values: SubjectFormValues) => {
      const payload = {
        name: { en: values.name_en, ar: values.name_ar },
        stage_ids:
          values.scope_type === "stage" ? values.stage_ids.map(Number) : [],
        grade_ids:
          values.scope_type === "grade" ? values.grade_ids.map(Number) : [],
      };

      return subject
        ? apiFetch<{ subject: Subject }>(`/api/subjects/${subject.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : apiFetch<{ subject: Subject }>("/api/subjects", {
            method: "POST",
            body: JSON.stringify(payload),
          });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success(subject ? t("updatedToast") : t("createdToast"));
      if (!subject) form.reset(defaultValues);
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
              ...(err.errors["stage_ids"] && {
                stage_ids: err.errors["stage_ids"],
              }),
              ...(err.errors["grade_ids"] && {
                grade_ids: err.errors["grade_ids"],
              }),
            })
          : err;

      const message = applyServerErrors(
        form,
        remapped,
        ["name_en", "name_ar", "stage_ids", "grade_ids"],
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
          name="name_en"
          render={({ field }) => (
            <FormItem className={cn(activeLocale !== "en" && "hidden")}>
              <div className="flex items-center justify-between">
                <FormLabel>{t("nameEnLabel")}</FormLabel>
                <LocaleTabs
                  value={activeLocale}
                  translate={{ en: "name_en", ar: "name_ar", what: "school subject name" }}
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
                  translate={{ en: "name_en", ar: "name_ar", what: "school subject name" }}
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

        <FormField
          control={form.control}
          name="scope_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("scopeTypeLabel")}</FormLabel>
              <FormControl>
                <Tabs
                  value={field.value}
                  onValueChange={(value) =>
                    field.onChange(value as SubjectScopeType)
                  }
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="stage">
                      {t("scopeStageLabel")}
                    </TabsTrigger>
                    <TabsTrigger value="grade">
                      {t("scopeGradeLabel")}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </FormControl>
            </FormItem>
          )}
        />

        {scopeType === "stage" ? (
          <FormField
            control={form.control}
            name="stage_ids"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("stagesLabel")}</FormLabel>
                <FormControl>
                  <MultiSelect
                    options={stages.map((stage) => ({
                      value: String(stage.id),
                      label: locale === "ar" ? stage.name_ar : stage.name_en,
                    }))}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("stagesPlaceholder")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="grade_ids"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("gradesLabel")}</FormLabel>
                <FormControl>
                  <MultiSelect
                    options={grades.map((grade) => ({
                      value: String(grade.id),
                      label: locale === "ar" ? grade.name_ar : grade.name_en,
                    }))}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("gradesPlaceholder")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {subject ? t("saveChanges") : t("createSubject")}
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
