import { z } from "zod";

// Validation messages come from the caller's `useTranslations("Validation")`
// — same convention as features/promotions/schema.ts.
type Translate = (key: string) => string;

export function createGraduateSchema(t: Translate) {
  return z.object({
    // stage_id/grade_id only narrow the classroom picker's option list —
    // a graduation always moves one whole classroom's active students out
    // of the roster at once (see GraduationService on the backend), so
    // they're not validated and never sent to the API. classroom_id is the
    // only field that matters.
    stage_id: z.string().optional(),
    grade_id: z.string().optional(),
    classroom_id: z.string().min(1, t("classroomRequired")),
  });
}

export type GraduateValues = z.infer<ReturnType<typeof createGraduateSchema>>;

export const defaultGraduateValues: GraduateValues = {
  stage_id: "",
  grade_id: "",
  classroom_id: "",
};

export function toGraduatePayload(
  values: GraduateValues,
  exceptStudentIds: number[]
) {
  return {
    classroom_id: Number(values.classroom_id),
    except_student_ids: exceptStudentIds,
  };
}
