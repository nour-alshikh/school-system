"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMoney } from "@/hooks/use-money";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { createFeeChargesSchema, type FeeChargesFormValues } from "./schema";
import type { FeeCharge } from "./types";
import type { Fee } from "@/features/fees/types";

const defaultValues: FeeChargesFormValues = {
  rows: [{ fee_id: "", amount_due: "" }],
};

// The backend validates each row as "charges.<index>.<field>" (it mirrors
// the request payload's shape); remap that onto this form's
// "rows.<index>.<field>" field names before handing off to
// applyServerErrors. See classrooms-bulk-form.tsx for the same convention.
function remapErrors(err: unknown): unknown {
  if (!(err instanceof ApiError) || !err.errors) return err;

  const remapped: Record<string, string[]> = {};

  for (const [field, messages] of Object.entries(err.errors)) {
    const match = field.match(/^charges\.(\d+)\.(fee_id|amount_due)$/);
    remapped[match ? `rows.${match[1]}.${match[2]}` : field] = messages;
  }

  return new ApiError(err.status, err.message, remapped);
}

export function FeeChargeForm({
  studentId,
  chargeableFees,
  onSuccess,
}: {
  studentId: number;
  chargeableFees: Fee[];
  onSuccess?: () => void;
}) {
  const t = useTranslations("FeeChargeForm");
  const money = useMoney();
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const queryClient = useQueryClient();

  const schema = useMemo(() => createFeeChargesSchema(tValidation), [tValidation]);

  const form = useForm<FeeChargesFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rows",
  });

  const selectedFeeIds = form.watch("rows").map((row) => row.fee_id);

  const mutation = useMutation({
    mutationFn: (values: FeeChargesFormValues) =>
      apiFetch<{ fee_charges: FeeCharge[] }>(
        `/api/students/${studentId}/fee-charges`,
        {
          method: "POST",
          body: JSON.stringify({
            charges: values.rows.map((row) => ({
              fee_id: Number(row.fee_id),
              amount_due: row.amount_due,
            })),
          }),
        }
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["fee-charges", studentId] });
      toast.success(t("createdToast", { count: data.fee_charges.length }));
      form.reset(defaultValues);
      onSuccess?.();
    },
    onError: (err) => {
      const message = applyServerErrors(
        form,
        remapErrors(err),
        [
          ...fields.map((_, i) => `rows.${i}.fee_id` as const),
          ...fields.map((_, i) => `rows.${i}.amount_due` as const),
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
        <div className="flex flex-col gap-3">
          {fields.map((rowField, index) => {
            // Excludes fees already picked in another row of this same
            // submission — a fee can only be charged once, so once it's
            // used here it drops out of every other row's options.
            const rowOptions = chargeableFees.filter(
              (fee) =>
                String(fee.id) === selectedFeeIds[index] ||
                !selectedFeeIds.includes(String(fee.id))
            );

            return (
              <div
                key={rowField.id}
                className="flex items-start gap-2 rounded-lg border p-3"
              >
                <FormField
                  control={form.control}
                  name={`rows.${index}.fee_id`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>{t("feeLabel")}</FormLabel>
                      <Select
                        items={rowOptions.map((fee) => ({
                          value: String(fee.id),
                          label: `${locale === "ar" ? fee.name_ar : fee.name_en} — ${money(fee.amount)}`,
                        }))}
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          const fee = chargeableFees.find(
                            (f) => String(f.id) === value
                          );
                          if (fee) {
                            form.setValue(`rows.${index}.amount_due`, fee.amount);
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t("feePlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {rowOptions.map((fee) => (
                            <SelectItem key={fee.id} value={String(fee.id)}>
                              {locale === "ar" ? fee.name_ar : fee.name_en} —{" "}
                              {fee.amount}
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
                  name={`rows.${index}.amount_due`}
                  render={({ field }) => (
                    <FormItem className="w-32">
                      <FormLabel>{t("amountDueLabel")}</FormLabel>
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
                  className="mt-6"
                  aria-label={t("removeRow")}
                  title={t("removeRow")}
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={fields.length >= chargeableFees.length}
          onClick={() => append({ fee_id: "", amount_due: "" })}
        >
          <Plus className="size-4" />
          {t("addRow")}
        </Button>

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("createCharge")}
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
