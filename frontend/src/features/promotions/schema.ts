import { z } from "zod";

// Validation messages come from the caller's `useTranslations("Validation")`
// — same convention as the other feature-foldered forms (see
// features/students/schema.ts).
type Translate = (key: string) => string;

export function createPromoteSchema(t: Translate) {
  return z.object({
    from: z.object({
      // stage_id/grade_id only narrow the classroom picker's option list —
      // a promotion always moves one whole classroom at a time (see
      // PromotionService on the backend), so they're not validated and
      // never sent to the API. classroom_id is the only field that matters.
      stage_id: z.string().optional(),
      grade_id: z.string().optional(),
      classroom_id: z.string().min(1, t("classroomRequired")),
    }),
    to: z.object({
      stage_id: z.string().min(1, t("stageRequired")),
      grade_id: z.string().min(1, t("gradeRequired")),
      classroom_id: z.string().min(1, t("classroomRequired")),
      academic_year_id: z.string().min(1, t("academicYearRequired")),
    }),
  });
}

export type PromoteValues = z.infer<ReturnType<typeof createPromoteSchema>>;

export const defaultPromoteValues: PromoteValues = {
  from: { stage_id: "", grade_id: "", classroom_id: "" },
  to: { stage_id: "", grade_id: "", classroom_id: "", academic_year_id: "" },
};

export function toPromotePayload(
  values: PromoteValues,
  exceptStudentIds: number[]
) {
  return {
    from: {
      classroom_id: Number(values.from.classroom_id),
    },
    to: {
      stage_id: Number(values.to.stage_id),
      grade_id: Number(values.to.grade_id),
      classroom_id: Number(values.to.classroom_id),
      academic_year_id: Number(values.to.academic_year_id),
    },
    except_student_ids: exceptStudentIds,
  };
}
