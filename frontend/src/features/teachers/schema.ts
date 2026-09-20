import { z } from "zod";

// Validation messages come from the caller's `useTranslations("Validation")`
// so they follow the active locale — see lib/schemas.ts for the same
// convention on the other (non-feature-foldered) forms.
type Translate = (key: string) => string;

export const teacherStatusOptions = ["active", "inactive", "on_leave"] as const;

export function createTeacherSchema(t: Translate) {
  return z
    .object({
      name: z.string().min(1, t("teacherNameRequired")).max(255),
      email: z.string().min(1, t("teacherEmailRequired")).email(t("teacherEmailInvalid")),
      phone: z.string().max(255).optional().or(z.literal("")),
      joining_date: z.string().min(1, t("teacherJoiningDateRequired")),
      status: z.enum(teacherStatusOptions),
      // Optional: blank keeps the login as-is (or leaves the teacher
      // without one). Only validated for length/confirmation when set —
      // see teacher-form.tsx's confirmed-match check below.
      password: z.string().min(8, t("passwordMin")).optional().or(z.literal("")),
      password_confirmation: z.string().optional().or(z.literal("")),
    })
    .refine((data) => !data.password || data.password === data.password_confirmation, {
      message: t("passwordsDontMatch"),
      path: ["password_confirmation"],
    });
}

export type TeacherFormValues = z.infer<ReturnType<typeof createTeacherSchema>>;
