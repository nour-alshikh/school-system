import { z } from "zod";

// Validation messages come from the caller's `useTranslations("Validation")`
// — same convention as the other feature-foldered forms (see
// features/students/schema.ts).
type Translate = (key: string) => string;

export function createPromoteSchema(t: Translate) {
  return z.object({
    from: z.object({
      stage_id: z.string().min(1, t("stageRequired")),
      // Optional — a bare stage promotes every grade under it, a stage +
      // grade promotes every classroom under that grade. See
      // PromotionService::resolveSourceStudents on the backend, which
      // mirrors this same "most specific field wins" rule.
      grade_id: z.string().optional(),
      classroom_id: z.string().optional(),
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
      stage_id: Number(values.from.stage_id),
      grade_id: values.from.grade_id ? Number(values.from.grade_id) : undefined,
      classroom_id: values.from.classroom_id
        ? Number(values.from.classroom_id)
        : undefined,
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
