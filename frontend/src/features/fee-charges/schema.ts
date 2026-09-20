import { z } from "zod";

// Validation messages come from the caller's `useTranslations("Validation")`
// so they follow the active locale — see lib/schemas.ts for the same
// convention on the other (non-feature-foldered) forms.
type Translate = (key: string) => string;

export const feePaymentMethods = ["cash", "bank_transfer", "card", "other"] as const;

export function createFeeChargeRowSchema(t: Translate) {
  return z.object({
    fee_id: z.string().min(1, t("feeChargeFeeRequired")),
    amount_due: z
      .string()
      .min(1, t("feeChargeAmountRequired"))
      .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
        message: t("feeChargeAmountInvalid"),
      }),
  });
}

export function createFeeChargesSchema(t: Translate) {
  return z.object({
    rows: z
      .array(createFeeChargeRowSchema(t))
      .min(1, t("feeChargeRowsRequired")),
  });
}

export type FeeChargeRowValues = z.infer<ReturnType<typeof createFeeChargeRowSchema>>;
export type FeeChargesFormValues = z.infer<ReturnType<typeof createFeeChargesSchema>>;

export function createFeeChargeAmountSchema(t: Translate) {
  return z.object({
    amount_due: z
      .string()
      .min(1, t("feeChargeAmountRequired"))
      .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
        message: t("feeChargeAmountInvalid"),
      }),
  });
}

export type FeeChargeAmountFormValues = z.infer<
  ReturnType<typeof createFeeChargeAmountSchema>
>;

export function createChargeAllFeeRowSchema(t: Translate) {
  return z.object({
    student_id: z.string(),
    amount_due: z
      .string()
      .min(1, t("feeChargeAmountRequired"))
      .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
        message: t("feeChargeAmountInvalid"),
      }),
  });
}

export function createChargeAllFeeSchema(t: Translate) {
  return z.object({
    rows: z
      .array(createChargeAllFeeRowSchema(t))
      .min(1, t("feeChargeRowsRequired")),
  });
}

export type ChargeAllFeeRowValues = z.infer<
  ReturnType<typeof createChargeAllFeeRowSchema>
>;
export type ChargeAllFeeFormValues = z.infer<
  ReturnType<typeof createChargeAllFeeSchema>
>;

export function createFeePaymentSchema(t: Translate) {
  return z.object({
    amount: z
      .string()
      .min(1, t("feePaymentAmountRequired"))
      .refine((v) => !Number.isNaN(Number(v)) && Number(v) !== 0, {
        message: t("feePaymentAmountInvalid"),
      }),
    paid_at: z.string().min(1, t("feePaymentDateRequired")),
    method: z.enum(feePaymentMethods),
    note: z.string().max(1000).optional(),
  });
}

export type FeePaymentFormValues = z.infer<ReturnType<typeof createFeePaymentSchema>>;
