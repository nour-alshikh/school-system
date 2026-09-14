import { z } from "zod";

// Validation messages come from the caller's `useTranslations("Validation")`
// so they follow the active locale — see lib/schemas.ts for the same
// convention on the other (non-feature-foldered) forms.
type Translate = (key: string) => string;

export function createGradeSchema(t: Translate) {
  return z.object({
    stage_id: z.string().min(1, t("gradeStageRequired")),
    name_en: z.string().min(1, t("gradeNameEnRequired")).max(255),
    name_ar: z.string().min(1, t("gradeNameArRequired")).max(255),
  });
}

export type GradeFormValues = z.infer<ReturnType<typeof createGradeSchema>>;
