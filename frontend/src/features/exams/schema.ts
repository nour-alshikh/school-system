import { z } from "zod";
import type { ExamKind, ExamStatus } from "./types";

// Validation messages come from the caller's `useTranslations("Validation")`
// so they follow the active locale — same convention as attendance/schema.ts.
type Translate = (key: string) => string;

export const examKindOptions = ["exam", "quiz"] as const satisfies readonly ExamKind[];
export const examStatusOptions = ["draft", "published"] as const satisfies readonly ExamStatus[];

// Numbers stay strings in form state (converted with Number() at submit,
// see toApiPayload in exam-form.tsx) rather than z.coerce.number() — same
// convention as classrooms/schema.ts's capacitySchema, which avoids the
// zodResolver input/output type mismatch z.coerce causes with
// useForm<T>'s single type parameter.
function positiveIntStringSchema(t: Translate, message: string) {
  return z.string().refine((value) => /^\d+$/.test(value) && Number(value) >= 1, message);
}

function createOptionSchema(t: Translate) {
  return z.object({
    text: z.string().min(1, t("optionTextRequired")).max(255),
  });
}

// correctIndex (not a per-option is_correct flag) keeps "exactly one
// correct option" true by construction instead of needing a cross-field
// check — the form can only ever select one radio per question. Mapped to
// the backend's {text, is_correct}[] shape at submit time — see
// toApiPayload in exam-form.tsx.
function createQuestionSchema(t: Translate) {
  return z
    .object({
      text: z.string().min(1, t("questionTextRequired")),
      marks: positiveIntStringSchema(t, t("marksMin")),
      options: z.array(createOptionSchema(t)).min(2, t("optionsMin")),
      correctIndex: z.number().int().min(0, t("correctOptionRequired")),
    })
    .refine((question) => question.correctIndex < question.options.length, {
      message: t("correctOptionRequired"),
      path: ["correctIndex"],
    });
}

export function createExamSchema(t: Translate) {
  return z
    .object({
      title: z.string().min(1, t("titleRequired")).max(255),
      type: z.enum(examKindOptions),
      subject_id: z.string().min(1, t("subjectRequired")),
      grade_id: z.string().min(1, t("gradeRequired")),
      // "" = whole grade — only an admin's form allows leaving this blank,
      // a teacher's form always has one preselected. See exam-form.tsx.
      classroom_id: z.string().optional().or(z.literal("")),
      instructions: z.string().max(5000).optional().or(z.literal("")),
      duration_minutes: positiveIntStringSchema(t, t("durationMin")),
      opens_at: z.string().min(1, t("opensAtRequired")),
      closes_at: z.string().min(1, t("closesAtRequired")),
      status: z.enum(examStatusOptions),
      questions: z.array(createQuestionSchema(t)).min(1, t("questionsMin")),
    })
    .refine((data) => new Date(data.closes_at) > new Date(data.opens_at), {
      message: t("closesAfterOpens"),
      path: ["closes_at"],
    });
}

export type ExamOptionValues = z.infer<ReturnType<typeof createOptionSchema>>;
export type ExamQuestionValues = z.infer<ReturnType<typeof createQuestionSchema>>;
export type ExamFormValues = z.infer<ReturnType<typeof createExamSchema>>;

export const defaultExamQuestion: ExamQuestionValues = {
  text: "",
  marks: "1",
  options: [{ text: "" }, { text: "" }],
  correctIndex: 0,
};

export const defaultExamValues: ExamFormValues = {
  title: "",
  type: "exam",
  subject_id: "",
  grade_id: "",
  classroom_id: "",
  instructions: "",
  duration_minutes: "30",
  opens_at: "",
  closes_at: "",
  status: "draft",
  questions: [defaultExamQuestion],
};
