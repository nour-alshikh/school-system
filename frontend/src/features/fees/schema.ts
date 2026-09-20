import { z } from "zod";

// Validation messages come from the caller's `useTranslations("Validation")`
// so they follow the active locale — see lib/schemas.ts for the same
// convention on the other (non-feature-foldered) forms.
type Translate = (key: string) => string;

export function createFeeSchema(t: Translate) {
  return z
    .object({
      name_en: z.string().min(1, t("feeNameEnRequired")).max(255),
      name_ar: z.string().min(1, t("feeNameArRequired")).max(255),
      academic_year_id: z.string().min(1, t("feeAcademicYearRequired")),
      amount: z
        .string()
        .min(1, t("feeAmountRequired"))
        .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
          message: t("feeAmountInvalid"),
        }),
      is_active: z.boolean(),
      is_for_all: z.boolean(),
      stage_id: z.string(),
      grade_id: z.string(),
    })
    .superRefine((values, ctx) => {
      if (values.is_for_all) return;

      if (!values.stage_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("feeStageRequired"),
          path: ["stage_id"],
        });
      }
      if (!values.grade_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("feeGradeRequired"),
          path: ["grade_id"],
        });
      }
    });
}

export type FeeFormValues = z.infer<ReturnType<typeof createFeeSchema>>;
