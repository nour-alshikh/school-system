"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  createAcademicYearSchema,
  type AcademicYearFormValues,
} from "./schema";
import type { AcademicYear } from "./types";

const defaultValues: AcademicYearFormValues = {
  year: "",
  is_current: false,
};

function valuesFromAcademicYear(
  academicYear: AcademicYear
): AcademicYearFormValues {
  return {
    year: String(academicYear.year),
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
        year: Number(values.year),
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
      const message = applyServerErrors(
        form,
        err,
        ["year", "is_current"],
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
          name="year"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("yearLabel")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  inputMode="numeric"
                  placeholder={t("yearPlaceholder")}
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
