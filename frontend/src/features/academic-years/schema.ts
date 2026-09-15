import { z } from "zod";

// Validation messages come from the caller's `useTranslations("Validation")`
// so they follow the active locale — see lib/schemas.ts for the same
// convention on the other (non-feature-foldered) forms.
type Translate = (key: string) => string;

export function createAcademicYearSchema(t: Translate) {
  return z.object({
    name_en: z.string().min(1, t("academicYearNameEnRequired")).max(255),
    name_ar: z.string().min(1, t("academicYearNameArRequired")).max(255),
    is_current: z.boolean(),
  });
}

export type AcademicYearFormValues = z.infer<
  ReturnType<typeof createAcademicYearSchema>
>;
