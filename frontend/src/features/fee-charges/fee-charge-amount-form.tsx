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
import {
  createFeeChargeAmountSchema,
  type FeeChargeAmountFormValues,
} from "./schema";
import type { FeeCharge } from "./types";

export function FeeChargeAmountForm({
  studentId,
  feeCharge,
  onSuccess,
}: {
  studentId: number;
  feeCharge: FeeCharge;
  onSuccess?: () => void;
}) {
  const t = useTranslations("FeeChargeAmountForm");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const queryClient = useQueryClient();

  const schema = useMemo(
    () => createFeeChargeAmountSchema(tValidation),
    [tValidation]
  );

  const form = useForm<FeeChargeAmountFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount_due: feeCharge.amount_due },
  });

  const mutation = useMutation({
    mutationFn: (values: FeeChargeAmountFormValues) =>
      apiFetch<{ fee_charge: FeeCharge }>(`/api/fee-charges/${feeCharge.id}`, {
        method: "PUT",
        body: JSON.stringify({ amount_due: values.amount_due }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-charges", studentId] });
      toast.success(t("updatedToast"));
      onSuccess?.();
    },
    onError: (err) => {
      const message = applyServerErrors(
        form,
        err,
        ["amount_due"],
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
            {t("save")}
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
