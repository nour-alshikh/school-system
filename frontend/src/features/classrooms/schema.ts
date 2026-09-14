import { z } from "zod";

// Validation messages come from the caller's `useTranslations("Validation")`
// so they follow the active locale — see lib/schemas.ts for the same
// convention on the other (non-feature-foldered) forms.
type Translate = (key: string) => string;

function capacitySchema(t: Translate) {
  return z
    .string()
    .optional()
    .refine(
      (value) => !value || (/^\d+$/.test(value) && Number(value) >= 1),
      t("classroomCapacityInvalid")
    );
}

export function createClassroomRowSchema(t: Translate) {
  return z.object({
    name: z.string().min(1, t("classroomNameRequired")).max(255),
    capacity: capacitySchema(t),
  });
}

export function createClassroomsSchema(t: Translate) {
  return z.object({
    grade_id: z.string().min(1, t("classroomGradeRequired")),
    rows: z
      .array(createClassroomRowSchema(t))
      .min(1, t("classroomRowsRequired")),
  });
}

export function createClassroomEditSchema(t: Translate) {
  return z.object({
    grade_id: z.string().min(1, t("classroomGradeRequired")),
    name: z.string().min(1, t("classroomNameRequired")).max(255),
    capacity: capacitySchema(t),
  });
}

export type ClassroomsFormValues = z.infer<
  ReturnType<typeof createClassroomsSchema>
>;
export type ClassroomEditFormValues = z.infer<
  ReturnType<typeof createClassroomEditSchema>
>;
