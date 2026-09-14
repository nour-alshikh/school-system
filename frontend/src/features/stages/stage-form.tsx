"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { createStageSchema, type StageFormValues } from "./schema";
import type { Stage } from "./types";

const defaultValues: StageFormValues = {
  name_en: "",
  name_ar: "",
};

function valuesFromStage(stage: Stage): StageFormValues {
  return {
    name_en: stage.name_en,
    name_ar: stage.name_ar,
  };
}

export function StageForm({
  stage,
  onSuccess,
}: {
  stage?: Stage;
  onSuccess?: () => void;
}) {
  const t = useTranslations("StageForm");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const queryClient = useQueryClient();

  const schema = useMemo(() => createStageSchema(tValidation), [tValidation]);

  const form = useForm<StageFormValues>({
    resolver: zodResolver(schema),
    defaultValues: stage ? valuesFromStage(stage) : defaultValues,
  });

  // Editing a different stage (or switching from create to edit) — sync the
  // form to the new record instead of keeping stale values around.
  useEffect(() => {
    form.reset(stage ? valuesFromStage(stage) : defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage?.id]);

  const mutation = useMutation({
    mutationFn: (values: StageFormValues) => {
      const payload = {
        name: { en: values.name_en, ar: values.name_ar },
      };

      return stage
        ? apiFetch<{ stage: Stage }>(`/api/stages/${stage.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : apiFetch<{ stage: Stage }>("/api/stages", {
            method: "POST",
            body: JSON.stringify(payload),
          });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stages"] });
      toast.success(stage ? t("updatedToast") : t("createdToast"));
      if (!stage) form.reset(defaultValues);
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
            })
          : err;

      const message = applyServerErrors(
        form,
        remapped,
        ["name_en", "name_ar"],
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
          name="name_en"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("nameEnLabel")}</FormLabel>
              <FormControl>
                <Input {...field} dir="ltr" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name_ar"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("nameArLabel")}</FormLabel>
              <FormControl>
                <Input {...field} dir="rtl" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? t("saving")
              : stage
                ? t("saveChanges")
                : t("createStage")}
          </Button>

          {stage && onSuccess && (
            <Button type="button" variant="outline" onClick={onSuccess}>
              {t("cancel")}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
