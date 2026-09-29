"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useMoney } from "@/hooks/use-money";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createFeePaymentSchema,
  feePaymentMethods,
  type FeePaymentFormValues,
} from "./schema";
import type { FeeCharge } from "./types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const defaultValues: FeePaymentFormValues = {
  amount: "",
  paid_at: today(),
  method: "cash",
  note: "",
};

export function FeePaymentForm({
  studentId,
  feeCharge,
  onSuccess,
}: {
  studentId: number;
  feeCharge: FeeCharge;
  onSuccess?: () => void;
}) {
  const t = useTranslations("FeePaymentForm");
  const money = useMoney();
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const queryClient = useQueryClient();

  const schema = useMemo(() => createFeePaymentSchema(tValidation), [tValidation]);

  const balance = money(
    Number(feeCharge.amount_due) - Number(feeCharge.amount_paid)
  );

  const methodLabels: Record<(typeof feePaymentMethods)[number], string> = {
    cash: t("methodCash"),
    bank_transfer: t("methodBankTransfer"),
    card: t("methodCard"),
    other: t("methodOther"),
  };

  const form = useForm<FeePaymentFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const mutation = useMutation({
    mutationFn: (values: FeePaymentFormValues) =>
      apiFetch<{ fee_charge: FeeCharge }>(
        `/api/fee-charges/${feeCharge.id}/payments`,
        {
          method: "POST",
          body: JSON.stringify({
            amount: values.amount,
            paid_at: values.paid_at,
            method: values.method,
            note: values.note || null,
          }),
        }
      ),
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
        ["amount", "paid_at", "method", "note"],
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
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("amountLabel")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  dir="ltr"
                  className="h-10"
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                {t("amountHint")} {t("balanceHint", { balance })}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="paid_at"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("dateLabel")}</FormLabel>
              <FormControl>
                <Input {...field} type="date" className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("methodLabel")}</FormLabel>
              <Select
                items={feePaymentMethods.map((method) => ({
                  value: method,
                  label: methodLabels[method],
                }))}
                value={field.value}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {feePaymentMethods.map((method) => (
                    <SelectItem key={method} value={method}>
                      {methodLabels[method]}
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
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("noteLabel")}</FormLabel>
              <FormControl>
                <Textarea {...field} rows={2} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("recordPayment")}
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
