import { z } from "zod";

// Validation messages come from the caller's `useTranslations("Validation")`
// so they follow the active locale — see lib/schemas.ts for the same
// convention on the other (non-feature-foldered) forms.
type Translate = (key: string) => string;

export const subjectScopeTypes = ["stage", "grade"] as const;
export type SubjectScopeType = (typeof subjectScopeTypes)[number];

export function createSubjectSchema(t: Translate) {
  return z
    .object({
      name_en: z.string().min(1, t("subjectNameEnRequired")).max(255),
      name_ar: z.string().min(1, t("subjectNameArRequired")).max(255),
      scope_type: z.enum(subjectScopeTypes),
      stage_ids: z.array(z.string()),
      grade_ids: z.array(z.string()),
    })
    .superRefine((values, ctx) => {
      const field = values.scope_type === "stage" ? "stage_ids" : "grade_ids";
      if (values[field].length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("subjectScopeRequired"),
          path: [field],
        });
      }
    });
}

export type SubjectFormValues = z.infer<ReturnType<typeof createSubjectSchema>>;
