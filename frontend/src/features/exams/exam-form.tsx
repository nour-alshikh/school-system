"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useFieldArray, useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createExamSchema,
  defaultExamQuestion,
  defaultExamValues,
  examKindOptions,
  examStatusOptions,
  type ExamFormValues,
} from "./schema";
import type { Exam, ExamTeachingAssignment } from "./types";
import { AiDraftButton } from "@/components/ai/ai-draft-button";
import { useAiDraft } from "@/hooks/use-ai-draft";
import { examHandoff } from "@/features/assistant/handoff";
import { cn } from "@/lib/utils";

/** POST /api/ai/draft/exam_questions (ExamQuestionsDrafter). */
type ExamQuestionsDraft = {
  title: string | null;
  instructions: string | null;
  questions: { text: string; options: string[]; correct: number; marks: number }[];
};

type SubjectOption = { id: number; name_en: string; name_ar: string };
type GradeOption = { id: number; name_en: string; name_ar: string };
type ClassroomOption = { id: number; name: string; grade_id: number };

function nameOf(locale: string, item: { name_en: string; name_ar: string }) {
  return locale === "ar" ? item.name_ar : item.name_en;
}

// ISO datetime -> the value <input type="datetime-local"> expects
// (local time, no timezone/seconds).
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function valuesFromExam(exam: Exam): ExamFormValues {
  return {
    title: exam.title,
    type: exam.type,
    subject_id: String(exam.subject_id),
    grade_id: String(exam.grade_id),
    classroom_id: exam.classroom_id != null ? String(exam.classroom_id) : "",
    instructions: exam.instructions ?? "",
    duration_minutes: String(exam.duration_minutes),
    opens_at: toLocalInputValue(exam.opens_at),
    closes_at: toLocalInputValue(exam.closes_at),
    status: exam.status,
    questions: exam.questions.map((question) => ({
      text: question.text,
      marks: String(question.marks),
      options: question.options.map((option) => ({ text: option.text })),
      correctIndex: Math.max(
        0,
        question.options.findIndex((option) => option.is_correct)
      ),
    })),
  };
}

// Maps the form's correctIndex-per-question shape to the backend's
// {text, is_correct}[] options shape — see schema.ts's createQuestionSchema
// for why the form never tracks is_correct directly.
function toApiPayload(values: ExamFormValues) {
  return {
    title: values.title,
    type: values.type,
    subject_id: Number(values.subject_id),
    grade_id: Number(values.grade_id),
    classroom_id: values.classroom_id ? Number(values.classroom_id) : null,
    instructions: values.instructions || null,
    duration_minutes: Number(values.duration_minutes),
    opens_at: new Date(values.opens_at).toISOString(),
    closes_at: new Date(values.closes_at).toISOString(),
    status: values.status,
    questions: values.questions.map((question) => ({
      text: question.text,
      marks: Number(question.marks),
      options: question.options.map((option, index) => ({
        text: option.text,
        is_correct: index === question.correctIndex,
      })),
    })),
  };
}

function QuestionCard({
  control,
  questionIndex,
  onRemove,
  canRemove,
}: {
  control: Control<ExamFormValues>;
  questionIndex: number;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const t = useTranslations("ExamFormPage");
  const {
    fields: optionFields,
    append: appendOption,
    remove: removeOption,
  } = useFieldArray({ control, name: `questions.${questionIndex}.options` });

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="pt-2 text-sm font-medium text-muted-foreground">
          {t("questionNumber", { number: questionIndex + 1 })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!canRemove}
          onClick={onRemove}
          aria-label={t("removeQuestion")}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <FormField
        control={control}
        name={`questions.${questionIndex}.text`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("questionTextLabel")}</FormLabel>
            <FormControl>
              <Textarea {...field} rows={2} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`questions.${questionIndex}.marks`}
        render={({ field }) => (
          <FormItem className="w-32">
            <FormLabel>{t("marksLabel")}</FormLabel>
            <FormControl>
              <Input type="number" min={1} className="h-10" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`questions.${questionIndex}.correctIndex`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("optionsLabel")}</FormLabel>
            <RadioGroup
              value={String(field.value)}
              onValueChange={(value) => field.onChange(Number(value))}
              className="flex flex-col gap-2"
            >
              {optionFields.map((optionField, optionIndex) => (
                <div key={optionField.id} className="flex items-center gap-2">
                  <RadioGroupItem
                    value={String(optionIndex)}
                    aria-label={t("correctOptionLabel", { number: optionIndex + 1 })}
                  />
                  <FormField
                    control={control}
                    name={`questions.${questionIndex}.options.${optionIndex}.text`}
                    render={({ field: textField }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            {...textField}
                            placeholder={t("optionPlaceholder", { number: optionIndex + 1 })}
                            className="h-10"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={optionFields.length <= 2}
                    onClick={() => {
                      removeOption(optionIndex);
                      if (field.value >= optionIndex && field.value > 0) {
                        field.onChange(field.value - 1);
                      }
                    }}
                    aria-label={t("removeOption")}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </RadioGroup>
            <FormMessage />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => appendOption({ text: "" })}
            >
              <Plus className="size-4" />
              {t("addOption")}
            </Button>
          </FormItem>
        )}
      />
    </div>
  );
}

export function ExamForm({
  exam,
  onSuccess,
}: {
  exam?: Exam;
  onSuccess?: (exam: Exam) => void;
}) {
  const t = useTranslations("ExamFormPage");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = useAuth();

  const isEdit = !!exam;
  const isAdmin = can("manage-exams");

  const [wholeGrade, setWholeGrade] = useState(isAdmin && !exam?.classroom_id);

  // A new exam the assistant was asked for (phase 6): its title, and the
  // request waiting in "Draft with AI" once the subject and class are picked.
  // This form only renders on the client, after auth.
  const [handoff] = useState(() => (exam ? null : examHandoff.peek()));
  useEffect(() => {
    if (handoff) examHandoff.forget();
  }, [handoff]);

  const schema = createExamSchema(tValidation);
  const form = useForm<ExamFormValues>({
    resolver: zodResolver(schema),
    defaultValues: exam
      ? valuesFromExam(exam)
      : { ...defaultExamValues, ...(handoff?.title ? { title: handoff.title } : {}) },
  });

  const gradeId = form.watch("grade_id");
  const classroomId = form.watch("classroom_id");
  const subjectId = form.watch("subject_id");

  // Draft with AI: new questions go after the ones already written (an
  // untouched blank question is dropped); title and instructions only fill
  // in when empty. The exam's subject and grade go along as context.
  const ai = useAiDraft<ExamFormValues, ExamQuestionsDraft>({
    form,
    kind: "exam_questions",
    context: {
      ...(subjectId ? { subject_id: Number(subjectId) } : {}),
      ...(gradeId ? { grade_id: Number(gradeId) } : {}),
    },
    toValues: (draft) => {
      const kept = form
        .getValues("questions")
        .filter((q) => q.text.trim() || q.options.some((o) => o.text.trim()));
      const added = draft.questions.map((q) => ({
        text: q.text,
        marks: String(q.marks),
        options: q.options.map((text) => ({ text })),
        correctIndex: q.correct,
      }));
      return {
        questions: [...kept, ...added],
        ...(!form.getValues("title").trim() && draft.title ? { title: draft.title } : {}),
        ...(!form.getValues("instructions")?.trim() && draft.instructions
          ? { instructions: draft.instructions }
          : {}),
      };
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () =>
      apiFetch<{ subjects: SubjectOption[] }>("/api/subjects").then((d) => d.subjects),
    enabled: isAdmin,
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["grades"],
    queryFn: () =>
      apiFetch<{ grades: GradeOption[] }>("/api/grades").then((d) => d.grades),
    enabled: isAdmin,
  });

  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms", "grade", gradeId],
    queryFn: () =>
      apiFetch<{ classrooms: ClassroomOption[] }>(
        `/api/classrooms?grade_id=${gradeId}`
      ).then((d) => d.classrooms),
    enabled: isAdmin && !!gradeId,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["exam-teaching-assignments"],
    queryFn: () =>
      apiFetch<{ assignments: ExamTeachingAssignment[] }>(
        "/api/exams/teaching-assignments"
      ).then((d) => d.assignments),
    enabled: !isAdmin,
  });

  const mutation = useMutation({
    mutationFn: (values: ExamFormValues) =>
      isEdit
        ? apiFetch<{ exam: Exam }>(`/api/exams/${exam.id}`, {
            method: "PUT",
            body: JSON.stringify(toApiPayload(values)),
          })
        : apiFetch<{ exam: Exam }>("/api/exams", {
            method: "POST",
            body: JSON.stringify(toApiPayload(values)),
          }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["exams"], exact: false });
      toast.success(isEdit ? t("updateSuccess") : t("createSuccess"));
      onSuccess?.(data.exam);
    },
    onError: (err) => {
      const message = applyServerErrors(
        form,
        err,
        [
          "title", "type", "subject_id", "grade_id", "classroom_id",
          "instructions", "duration_minutes", "opens_at", "closes_at", "status",
        ],
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    },
  });

  const {
    fields: questionFields,
    append: appendQuestion,
    remove: removeQuestion,
  } = useFieldArray({ control: form.control, name: "questions" });

  function handleAssignmentChange(value: string | null) {
    const assignment = assignments.find(
      (a) => `${a.classroom_id}:${a.subject_id}` === value
    );
    if (!assignment) return;
    form.setValue("classroom_id", String(assignment.classroom_id), { shouldValidate: true });
    form.setValue("subject_id", String(assignment.subject_id), { shouldValidate: true });
    form.setValue("grade_id", String(assignment.grade_id), { shouldValidate: true });
  }

  const selectedAssignmentValue = `${classroomId}:${subjectId}`;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="flex flex-col gap-6"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("titleLabel")}</FormLabel>
              <FormControl>
                <Input {...field} className={cn("h-10", ai.highlight("title"))} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("typeLabel")}</FormLabel>
              <Select
                items={examKindOptions.map((option) => ({
                  value: option,
                  label: t(`kind.${option}`),
                }))}
                value={field.value}
                onValueChange={(value) => value && field.onChange(value)}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {examKindOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`kind.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {isAdmin ? (
          <>
            <FormField
              control={form.control}
              name="subject_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("subjectLabel")}</FormLabel>
                  <Select
                    items={subjects.map((s) => ({ value: String(s.id), label: nameOf(locale, s) }))}
                    value={field.value}
                    onValueChange={(value) => field.onChange(value ?? "")}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("subjectPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {nameOf(locale, s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="grade_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("gradeLabel")}</FormLabel>
                  <Select
                    items={grades.map((g) => ({ value: String(g.id), label: nameOf(locale, g) }))}
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value ?? "");
                      form.setValue("classroom_id", "");
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("gradePlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {grades.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {nameOf(locale, g)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-row items-center gap-2">
              <Checkbox
                checked={wholeGrade}
                onCheckedChange={(checked) => {
                  setWholeGrade(!!checked);
                  if (checked) form.setValue("classroom_id", "");
                }}
              />
              <span className="text-sm font-normal">{t("wholeGradeLabel")}</span>
            </div>

            {!wholeGrade && (
              <FormField
                control={form.control}
                name="classroom_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("classroomLabel")}</FormLabel>
                    <Select
                      items={classrooms.map((c) => ({ value: String(c.id), label: c.name }))}
                      value={field.value}
                      onValueChange={(value) => field.onChange(value ?? "")}
                      disabled={!gradeId}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("classroomPlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {classrooms.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </>
        ) : (
          <FormItem>
            <FormLabel>{t("classroomSubjectLabel")}</FormLabel>
            <Select
              items={assignments.map((a) => ({
                value: `${a.classroom_id}:${a.subject_id}`,
                label: `${a.classroom_name} — ${nameOf(locale, { name_en: a.subject_name_en, name_ar: a.subject_name_ar })}`,
              }))}
              value={selectedAssignmentValue}
              onValueChange={handleAssignmentChange}
            >
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("classroomSubjectPlaceholder")} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {assignments.map((a) => (
                  <SelectItem key={`${a.classroom_id}:${a.subject_id}`} value={`${a.classroom_id}:${a.subject_id}`}>
                    {a.classroom_name} — {nameOf(locale, { name_en: a.subject_name_en, name_ar: a.subject_name_ar })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(form.formState.errors.classroom_id || form.formState.errors.subject_id) && (
              <p className="text-sm text-destructive">{t("classroomSubjectRequired")}</p>
            )}
            {assignments.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("noAssignments")}</p>
            )}
          </FormItem>
        )}

        <FormField
          control={form.control}
          name="instructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("instructionsLabel")}</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} className={ai.highlight("instructions")} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-wrap gap-4">
          <FormField
            control={form.control}
            name="duration_minutes"
            render={({ field }) => (
              <FormItem className="w-40">
                <FormLabel>{t("durationLabel")}</FormLabel>
                <FormControl>
                  <Input type="number" min={1} className="h-10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="opens_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("opensAtLabel")}</FormLabel>
                <FormControl>
                  <Input type="datetime-local" className="h-10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="closes_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("closesAtLabel")}</FormLabel>
                <FormControl>
                  <Input type="datetime-local" className="h-10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("statusLabel")}</FormLabel>
              <Select
                items={examStatusOptions.map((option) => ({
                  value: option,
                  label: t(`status.${option}`),
                }))}
                value={field.value}
                onValueChange={(value) => value && field.onChange(value)}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {examStatusOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`status.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{t("questionsHeading")}</h3>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <AiDraftButton
                ai={ai}
                hint={t("aiHint")}
                placeholder={t("aiPlaceholder")}
                initialNotes={handoff?.request}
                defaultOpen={!!handoff}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendQuestion(defaultExamQuestion)}
              >
                <Plus className="size-4" />
                {t("addQuestion")}
              </Button>
            </div>
          </div>

          {questionFields.map((field, index) => (
            <QuestionCard
              key={field.id}
              control={form.control}
              questionIndex={index}
              canRemove={questionFields.length > 1}
              onRemove={() => removeQuestion(index)}
            />
          ))}

          {form.formState.errors.questions?.message && (
            <p className="text-sm text-destructive">
              {form.formState.errors.questions.message}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? t("saveChanges") : t("createExam")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/exams")}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
