import { z } from "zod";

// Validation messages come from the caller's `useTranslations("Validation")`
// so they follow the active locale — see lib/schemas.ts for the same
// convention on the other (non-feature-foldered) forms.
type Translate = (key: string) => string;

export function createAcademicYearSchema(t: Translate) {
  return z.object({
    year: z
      .string()
      .min(1, t("academicYearYearRequired"))
      .regex(/^\d{4}$/, t("academicYearYearInvalid")),
    is_current: z.boolean(),
  });
}

export type AcademicYearFormValues = z.infer<
  ReturnType<typeof createAcademicYearSchema>
>;
