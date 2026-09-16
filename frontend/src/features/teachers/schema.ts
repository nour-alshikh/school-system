import { z } from "zod";

// Validation messages come from the caller's `useTranslations("Validation")`
// so they follow the active locale — see lib/schemas.ts for the same
// convention on the other (non-feature-foldered) forms.
type Translate = (key: string) => string;

export const teacherStatusOptions = ["active", "inactive", "on_leave"] as const;

export function createTeacherSchema(t: Translate) {
  return z.object({
    name: z.string().min(1, t("teacherNameRequired")).max(255),
    email: z.string().min(1, t("teacherEmailRequired")).email(t("teacherEmailInvalid")),
    phone: z.string().max(255).optional().or(z.literal("")),
    joining_date: z.string().min(1, t("teacherJoiningDateRequired")),
    status: z.enum(teacherStatusOptions),
  });
}

export type TeacherFormValues = z.infer<ReturnType<typeof createTeacherSchema>>;
