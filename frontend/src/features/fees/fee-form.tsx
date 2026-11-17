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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocaleTabs } from "@/components/locale-tabs";
import { createFeeSchema, type FeeFormValues } from "./schema";
import type { Fee } from "./types";
import type { AcademicYear } from "@/features/academic-years/types";
import type { Stage } from "@/features/stages/types";
import type { Grade } from "@/features/grades/types";

const defaultValues: FeeFormValues = {
  name_en: "",
  name_ar: "",
  academic_year_id: "",
  amount: "",
  is_active: true,
  is_for_all: false,
  stage_id: "",
  grade_id: "",
};

function valuesFromFee(fee: Fee): FeeFormValues {
  return {
    name_en: fee.name_en,
    name_ar: fee.name_ar,
    academic_year_id: String(fee.academic_year_id),
    amount: fee.amount,
    is_active: fee.is_active,
    is_for_all: fee.is_for_all,
    stage_id: fee.stage_id ? String(fee.stage_id) : "",
    grade_id: fee.grade_id ? String(fee.grade_id) : "",
  };
}

export function FeeForm({
  fee,
  onSuccess,
}: {
  fee?: Fee;
  onSuccess?: () => void;
}) {
  const t = useTranslations("FeeForm");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [activeLocale, setActiveLocale] = useState<"en" | "ar">("en");

  const schema = useMemo(() => createFeeSchema(tValidation), [tValidation]);

  const { data: academicYears = [] } = useQuery({
    queryKey: ["academic-years-all"],
    queryFn: () =>
      apiFetch<{ academic_years: AcademicYear[] }>("/api/academic-years").then(
        (d) => d.academic_years
      ),
  });

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

  const form = useForm<FeeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: fee ? valuesFromFee(fee) : defaultValues,
  });

  const isForAll = form.watch("is_for_all");
  const stageId = form.watch("stage_id");

  // A grade belongs to exactly one stage — only offer the ones under the
  // stage picked above, same as GradeForm/StudentWizard's cascading selects.
  const gradesForStage = grades.filter((g) => String(g.stage_id) === stageId);

  const mutation = useMutation({
    mutationFn: (values: FeeFormValues) => {
      const payload = {
        name: { en: values.name_en, ar: values.name_ar },
        academic_year_id: Number(values.academic_year_id),
        amount: values.amount,
        is_active: values.is_active,
        is_for_all: values.is_for_all,
        stage_id: values.is_for_all ? null : Number(values.stage_id),
        grade_id: values.is_for_all ? null : Number(values.grade_id),
      };

      return fee
        ? apiFetch<{ fee: Fee }>(`/api/fees/${fee.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : apiFetch<{ fee: Fee }>("/api/fees", {
            method: "POST",
            body: JSON.stringify(payload),
          });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      toast.success(fee ? t("updatedToast") : t("createdToast"));
      if (!fee) form.reset(defaultValues);
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
              ...(err.errors["academic_year_id"] && {
                academic_year_id: err.errors["academic_year_id"],
              }),
              ...(err.errors["amount"] && { amount: err.errors["amount"] }),
              ...(err.errors["is_active"] && {
                is_active: err.errors["is_active"],
              }),
              ...(err.errors["stage_id"] && { stage_id: err.errors["stage_id"] }),
              ...(err.errors["grade_id"] && { grade_id: err.errors["grade_id"] }),
            })
          : err;

      const message = applyServerErrors(
        form,
        remapped,
        [
          "name_en",
          "name_ar",
          "academic_year_id",
          "amount",
          "is_active",
          "stage_id",
          "grade_id",
        ],
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
                  translate={{ en: "name_en", ar: "name_ar", what: "school fee name" }}
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
                  translate={{ en: "name_en", ar: "name_ar", what: "school fee name" }}
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
          name="academic_year_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("academicYearLabel")}</FormLabel>
              <Select
                items={academicYears.map((year) => ({
                  value: String(year.id),
                  label: String(year.year),
                }))}
                value={field.value}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("academicYearPlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {academicYears.map((year) => (
                    <SelectItem key={year.id} value={String(year.id)}>
                      {year.year}
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
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("amountLabel")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  dir="ltr"
                  className="h-10"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(!!checked)}
                />
              </FormControl>
              <FormLabel className="font-normal">
                {t("isActiveLabel")}
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_for_all"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(!!checked);
                    if (checked) {
                      form.setValue("stage_id", "");
                      form.setValue("grade_id", "");
                    }
                  }}
                />
              </FormControl>
              <FormLabel className="font-normal">
                {t("isForAllLabel")}
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        {!isForAll && (
          <>
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
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("grade_id", "");
                    }}
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
              name="grade_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("gradeLabel")}</FormLabel>
                  <Select
                    items={gradesForStage.map((grade) => ({
                      value: String(grade.id),
                      label: locale === "ar" ? grade.name_ar : grade.name_en,
                    }))}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full" disabled={!stageId}>
                        <SelectValue placeholder={t("gradePlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {gradesForStage.map((grade) => (
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
          </>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {fee ? t("saveChanges") : t("createFee")}
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
