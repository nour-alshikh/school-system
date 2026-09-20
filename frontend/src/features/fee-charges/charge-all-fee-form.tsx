"use client";

import { useEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createChargeAllFeeSchema, type ChargeAllFeeFormValues } from "./schema";
import type { FeeMatchingStudent } from "./types";
import type { Fee } from "@/features/fees/types";

// The backend validates each row as "charges.<index>.<field>" (it mirrors
// the request payload's shape); remap that onto this form's
// "rows.<index>.<field>" field names before handing off to
// applyServerErrors. See fee-charge-form.tsx for the same convention.
function remapErrors(err: unknown): unknown {
  if (!(err instanceof ApiError) || !err.errors) return err;

  const remapped: Record<string, string[]> = {};

  for (const [field, messages] of Object.entries(err.errors)) {
    const match = field.match(/^charges\.(\d+)\.(student_id|amount_due)$/);
    remapped[match ? `rows.${match[1]}.${match[2]}` : field] = messages;
  }

  return new ApiError(err.status, err.message, remapped);
}

export function ChargeAllFeeForm({
  fee,
  onSuccess,
}: {
  fee: Fee;
  onSuccess?: () => void;
}) {
  const t = useTranslations("ChargeAllFeeForm");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const queryClient = useQueryClient();

  const schema = useMemo(() => createChargeAllFeeSchema(tValidation), [tValidation]);

  const {
    data: students,
    isLoading: isLoadingStudents,
    error: studentsError,
  } = useQuery({
    queryKey: ["fee-matching-students", fee.id],
    queryFn: () =>
      apiFetch<{ students: FeeMatchingStudent[] }>(
        `/api/fees/${fee.id}/matching-students`
      ).then((d) => d.students),
  });

  useEffect(() => {
    if (!studentsError) return;
    toast.error(
      studentsError instanceof ApiError ? studentsError.message : t("loadError")
    );
  }, [studentsError, t]);

  const studentNames = new Map(
    (students ?? []).map((s) => [
      String(s.id),
      locale === "ar" ? s.name_ar : s.name_en,
    ])
  );

  const form = useForm<ChargeAllFeeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rows: [] },
  });

  const { fields, remove, replace } = useFieldArray({
    control: form.control,
    name: "rows",
  });

  // Rows arrive asynchronously (the matching-students fetch), so they're
  // seeded once the query resolves rather than as static defaultValues —
  // every matched student starts pre-filled at the fee's catalog amount,
  // editable (or removable) per row before submit.
  useEffect(() => {
    if (!students) return;
    replace(
      students.map((s) => ({ student_id: String(s.id), amount_due: fee.amount }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students]);

  const mutation = useMutation({
    mutationFn: (values: ChargeAllFeeFormValues) =>
      apiFetch<{ charged_count: number }>(`/api/fees/${fee.id}/charge-all`, {
        method: "POST",
        body: JSON.stringify({
          charges: values.rows.map((row) => ({
            student_id: Number(row.student_id),
            amount_due: row.amount_due,
          })),
        }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["fee-matching-students", fee.id] });
      toast.success(t("createdToast", { count: data.charged_count }));
      onSuccess?.();
    },
    onError: (err) => {
      const message = applyServerErrors(
        form,
        remapErrors(err),
        [
          ...fields.map((_, i) => `rows.${i}.student_id` as const),
          ...fields.map((_, i) => `rows.${i}.amount_due` as const),
        ],
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    },
  });

  if (isLoadingStudents) {
    return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  }

  // Checked against `students` (the fetch result), not `fields` — `fields`
  // only catches up once the effect above runs, and gating on it here would
  // flash this empty state for a tick even when there are real matches.
  if (!students || students.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("noMatches")}</p>
        {onSuccess && (
          <Button type="button" variant="outline" onClick={onSuccess}>
            {t("cancel")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-muted-foreground">
          {t("matchCount", { count: fields.length })}
        </p>

        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {fields.map((rowField, index) => (
            <div
              key={rowField.id}
              className="flex items-start gap-2 rounded-lg border p-2"
            >
              <div className="flex flex-1 items-center pt-2 text-sm">
                {studentNames.get(rowField.student_id) ?? rowField.student_id}
              </div>

              <FormField
                control={form.control}
                name={`rows.${index}.amount_due`}
                render={({ field }) => (
                  <FormItem className="w-32">
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

              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("removeRow")}
                title={t("removeRow")}
                onClick={() => remove(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("chargeAll")}
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
