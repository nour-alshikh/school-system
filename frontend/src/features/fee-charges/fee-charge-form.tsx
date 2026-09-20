"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createFeeChargeSchema, type FeeChargeFormValues } from "./schema";
import type { FeeCharge } from "./types";
import type { Fee } from "@/features/fees/types";

const defaultValues: FeeChargeFormValues = {
  fee_id: "",
  amount_due: "",
};

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
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const queryClient = useQueryClient();

  const schema = useMemo(() => createFeeChargeSchema(tValidation), [tValidation]);

  const form = useForm<FeeChargeFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const mutation = useMutation({
    mutationFn: (values: FeeChargeFormValues) =>
      apiFetch<{ fee_charge: FeeCharge }>(`/api/students/${studentId}/fee-charges`, {
        method: "POST",
        body: JSON.stringify({
          fee_id: Number(values.fee_id),
          amount_due: values.amount_due,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-charges", studentId] });
      toast.success(t("createdToast"));
      form.reset(defaultValues);
      onSuccess?.();
    },
    onError: (err) => {
      const message = applyServerErrors(
        form,
        err,
        ["fee_id", "amount_due"],
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
          name="fee_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("feeLabel")}</FormLabel>
              <Select
                items={chargeableFees.map((fee) => ({
                  value: String(fee.id),
                  label: `${locale === "ar" ? fee.name_ar : fee.name_en} — ${fee.amount}`,
                }))}
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  const fee = chargeableFees.find((f) => String(f.id) === value);
                  if (fee) form.setValue("amount_due", fee.amount);
                }}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("feePlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {chargeableFees.map((fee) => (
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
          name="amount_due"
          render={({ field }) => (
            <FormItem>
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
