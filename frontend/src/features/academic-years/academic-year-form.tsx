"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { LocaleTabs } from "@/components/locale-tabs";
import {
  createAcademicYearSchema,
  type AcademicYearFormValues,
} from "./schema";
import type { AcademicYear } from "./types";

const defaultValues: AcademicYearFormValues = {
  name_en: "",
  name_ar: "",
  is_current: false,
};

function valuesFromAcademicYear(
  academicYear: AcademicYear
): AcademicYearFormValues {
  return {
    name_en: academicYear.name_en,
    name_ar: academicYear.name_ar,
    is_current: academicYear.is_current,
  };
}

export function AcademicYearForm({
  academicYear,
  onSuccess,
}: {
  academicYear?: AcademicYear;
  onSuccess?: () => void;
}) {
  const t = useTranslations("AcademicYearForm");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const queryClient = useQueryClient();
  const [activeLocale, setActiveLocale] = useState<"en" | "ar">("en");

  const schema = useMemo(
    () => createAcademicYearSchema(tValidation),
    [tValidation]
  );

  const form = useForm<AcademicYearFormValues>({
    resolver: zodResolver(schema),
    defaultValues: academicYear
      ? valuesFromAcademicYear(academicYear)
      : defaultValues,
  });

  const mutation = useMutation({
    mutationFn: (values: AcademicYearFormValues) => {
      const payload = {
        name: { en: values.name_en, ar: values.name_ar },
        is_current: values.is_current,
      };

      return academicYear
        ? apiFetch<{ academic_year: AcademicYear }>(
            `/api/academic-years/${academicYear.id}`,
            { method: "PUT", body: JSON.stringify(payload) }
          )
        : apiFetch<{ academic_year: AcademicYear }>("/api/academic-years", {
            method: "POST",
            body: JSON.stringify(payload),
          });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      toast.success(academicYear ? t("updatedToast") : t("createdToast"));
      if (!academicYear) form.reset(defaultValues);
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
              ...(err.errors["is_current"] && {
                is_current: err.errors["is_current"],
              }),
            })
          : err;

      const message = applyServerErrors(
        form,
        remapped,
        ["name_en", "name_ar", "is_current"],
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
            else if (errors.name_ar && activeLocale !== "ar")
              setActiveLocale("ar");
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
          name="is_current"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(!!checked)}
                />
              </FormControl>
              <FormLabel className="font-normal">
                {t("isCurrentLabel")}
              </FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {academicYear ? t("saveChanges") : t("createAcademicYear")}
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
