"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "@/i18n/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PageLoader } from "@/components/page-loader";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Section, SelectField, type Option } from "@/features/students/guardian-fields";
import type { Student } from "@/features/students/types";
import {
  createPromoteSchema,
  defaultPromoteValues,
  toPromotePayload,
  type PromoteValues,
} from "./schema";
import type {
  AcademicYearType,
  ClassroomType,
  GradeType,
  StageType,
} from "@/types/generated";

const KNOWN_FIELDS = [
  "from.classroom_id",
  "to.stage_id",
  "to.grade_id",
  "to.classroom_id",
  "to.academic_year_id",
] as const;

function nameOf(locale: string, item: { name_en: string; name_ar: string }) {
  return locale === "ar" ? item.name_ar : item.name_en;
}

function toOptions(
  locale: string,
  items: { id: number; name_en: string; name_ar: string }[]
): Option[] {
  return items.map((item) => ({ value: String(item.id), label: nameOf(locale, item) }));
}

export function PromotionsPage() {
  const t = useTranslations("PromotionsPage");
  const tTable = useTranslations("Table");
  const tWizard = useTranslations("StudentWizard");
  const tValidation = useTranslations("Validation");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canManage = can("manage-students");

  // Deep-linked from StudentsPage's "Promote classroom"/"Promote selected"
  // actions: classroom_id pre-fills the From section, student_ids (a subset
  // of that classroom) pre-excludes everyone else — see the two prefill
  // effects below, once classrooms/grades and the matched-students list
  // have actually loaded.
  const searchParams = useSearchParams();
  const prefillClassroomId = searchParams.get("classroom_id");
  const prefillStudentIds = searchParams.get("student_ids");

  const [exceptIds, setExceptIds] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [classroomPrefillApplied, setClassroomPrefillApplied] = useState(
    !prefillClassroomId
  );
  const [exceptPrefillApplied, setExceptPrefillApplied] = useState(
    !prefillStudentIds
  );

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/promotions");
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!isAuthLoading && user && !canManage) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, canManage, router]);

  const schema = createPromoteSchema(tValidation);
  const form = useForm<PromoteValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultPromoteValues,
  });
  const { control } = form;

  const fromStageId = form.watch("from.stage_id");
  const fromGradeId = form.watch("from.grade_id");
  const fromClassroomId = form.watch("from.classroom_id");
  const toStageId = form.watch("to.stage_id");
  const toGradeId = form.watch("to.grade_id");

  const { data: stagesData } = useQuery({
    queryKey: ["stages"],
    queryFn: () =>
      apiFetch<{ stages: StageType[] }>("/api/stages").then((d) => d.stages),
    enabled: !isAuthLoading && !!user && canManage,
  });
  const stages = stagesData ?? [];

  const { data: gradesData } = useQuery({
    queryKey: ["grades"],
    queryFn: () =>
      apiFetch<{ grades: GradeType[] }>("/api/grades").then((d) => d.grades),
    enabled: !isAuthLoading && !!user && canManage,
  });
  const grades = gradesData ?? [];

  const { data: classroomsData } = useQuery({
    queryKey: ["classrooms"],
    queryFn: () =>
      apiFetch<{ classrooms: ClassroomType[] }>("/api/classrooms").then(
        (d) => d.classrooms
      ),
    enabled: !isAuthLoading && !!user && canManage,
  });
  const classrooms = classroomsData ?? [];

  useEffect(() => {
    if (classroomPrefillApplied || !prefillClassroomId) return;
    if (!classroomsData || !gradesData) return;

    const classroom = classroomsData.find((c) => c.id === Number(prefillClassroomId));
    if (classroom) {
      const grade = gradesData.find((g) => g.id === classroom.grade_id);
      form.setValue("from.stage_id", grade ? String(grade.stage_id) : "");
      form.setValue("from.grade_id", String(classroom.grade_id));
      form.setValue("from.classroom_id", String(classroom.id));
    }
    setClassroomPrefillApplied(true);
  }, [classroomPrefillApplied, prefillClassroomId, classroomsData, gradesData, form]);

  const { data: academicYearsData } = useQuery({
    queryKey: ["academic-years-all"],
    queryFn: () =>
      apiFetch<{ academic_years: AcademicYearType[] }>(
        "/api/academic-years"
      ).then((d) => d.academic_years),
    enabled: !isAuthLoading && !!user && canManage,
  });
  const academicYearOptions = toOptions(locale, academicYearsData ?? []);

  const stageOptions = toOptions(locale, stages);

  // A classroom picker scoped only by grade_id would show every classroom
  // in the school once a stage is picked but no grade yet — scope it by
  // stage too (via each classroom's grade) so it never outgrows the
  // stage/grade already chosen above it.
  function classroomOptionsFor(stageId: string, gradeId: string) {
    if (gradeId) {
      return classrooms
        .filter((c) => c.grade_id === Number(gradeId))
        .map((c) => ({ value: String(c.id), label: c.name }));
    }
    if (stageId) {
      const gradeIds = new Set(
        grades.filter((g) => g.stage_id === Number(stageId)).map((g) => g.id)
      );
      return classrooms
        .filter((c) => gradeIds.has(c.grade_id))
        .map((c) => ({ value: String(c.id), label: c.name }));
    }
    return classrooms.map((c) => ({ value: String(c.id), label: c.name }));
  }

  const fromGradeOptions = toOptions(
    locale,
    fromStageId ? grades.filter((g) => g.stage_id === Number(fromStageId)) : grades
  );
  const fromClassroomOptions = classroomOptionsFor(fromStageId ?? "", fromGradeId ?? "");

  const toGradeOptions = toOptions(
    locale,
    toStageId ? grades.filter((g) => g.stage_id === Number(toStageId)) : grades
  );
  const toClassroomOptions = classroomOptionsFor(toStageId, toGradeId);

  const {
    data: matchedStudents = [],
    isLoading: isLoadingMatched,
    error: matchedError,
  } = useQuery({
    queryKey: ["students", "promote-source", fromClassroomId],
    queryFn: () =>
      apiFetch<{ students: Student[] }>(
        `/api/students?classroom_id=${fromClassroomId}`
      ).then((d) => d.students),
    enabled: !isAuthLoading && !!user && canManage && !!fromClassroomId,
  });

  // A different classroom invalidates the previous "except" picks — done
  // during render (comparing against the previous committed value) rather
  // than in an effect, so it applies in the same render. The student_ids
  // prefill effect below runs after this and overrides it once the matched
  // list actually loads.
  const [prevFromClassroomId, setPrevFromClassroomId] = useState(fromClassroomId);
  if (fromClassroomId !== prevFromClassroomId) {
    setPrevFromClassroomId(fromClassroomId);
    setExceptIds(new Set());
  }

  useEffect(() => {
    if (exceptPrefillApplied || !prefillStudentIds) return;
    if (isLoadingMatched || matchedStudents.length === 0) return;

    const includeIds = new Set(prefillStudentIds.split(",").map(Number));
    setExceptIds(
      new Set(
        matchedStudents.filter((s) => !includeIds.has(s.id)).map((s) => s.id)
      )
    );
    setExceptPrefillApplied(true);
  }, [exceptPrefillApplied, prefillStudentIds, isLoadingMatched, matchedStudents]);

  const includedCount = matchedStudents.filter((s) => !exceptIds.has(s.id)).length;

  function toggleIncluded(id: number, checked: boolean) {
    setExceptIds((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllIncluded(checked: boolean) {
    setExceptIds(checked ? new Set() : new Set(matchedStudents.map((s) => s.id)));
  }

  const allIncluded = matchedStudents.length > 0 && exceptIds.size === 0;

  useEffect(() => {
    if (!matchedError) return;
    toast.error(matchedError instanceof ApiError ? matchedError.message : t("loadError"));
  }, [matchedError, t]);

  const promoteMutation = useMutation({
    mutationFn: (values: PromoteValues) =>
      apiFetch<{ promoted_count: number }>("/api/promotions", {
        method: "POST",
        body: JSON.stringify(toPromotePayload(values, Array.from(exceptIds))),
      }),
    onSuccess: (data) => {
      toast.success(t("successToast", { count: data.promoted_count }));
      queryClient.invalidateQueries({ queryKey: ["students"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["promotions"], exact: false });
      form.resetField("from.stage_id");
      form.resetField("from.grade_id");
      form.resetField("from.classroom_id");
      setExceptIds(new Set());
      setConfirmOpen(false);
    },
    onError: (err) => {
      const message = applyServerErrors(form, err, KNOWN_FIELDS, t("promoteError"));
      if (message) toast.error(message);
      setConfirmOpen(false);
    },
  });

  function onValid() {
    if (includedCount === 0) return;
    setConfirmOpen(true);
  }

  if (isAuthLoading || !user || !canManage) {
    return <PageLoader />;
  }

  const values = form.getValues();
  const targetClassroomLabel =
    toClassroomOptions.find((o) => o.value === values.to.classroom_id)?.label ?? "";

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold">{t("heading")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.push("/promotions/history")}
        >
          <History className="size-4" />
          {t("viewHistory")}
        </Button>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onValid)}
          className="flex flex-col gap-6"
        >
          <Section title={t("fromHeading")}>
            <SelectField
              control={control}
              name="from.stage_id"
              label={tWizard("stageLabel")}
              placeholder={tWizard("stagePlaceholder")}
              options={stageOptions}
              onSelect={() => {
                form.setValue("from.grade_id", "");
                form.setValue("from.classroom_id", "");
              }}
            />
            <SelectField
              control={control}
              name="from.grade_id"
              label={tWizard("gradeLabel")}
              placeholder={tWizard("gradePlaceholder")}
              options={fromGradeOptions}
              disabled={!fromStageId}
              onSelect={() => form.setValue("from.classroom_id", "")}
            />
            <SelectField
              control={control}
              name="from.classroom_id"
              label={tWizard("classroomLabel")}
              placeholder={tWizard("classroomPlaceholder")}
              options={fromClassroomOptions}
            />
          </Section>

          {fromClassroomId && (
            <div className="flex flex-col gap-2 rounded-lg border p-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("matchedHeading", { count: matchedStudents.length })}
              </h3>

              {isLoadingMatched ? (
                <p className="text-sm text-muted-foreground">…</p>
              ) : matchedStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noMatched")}</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{t("excludeHint")}</p>
                  <label className="flex items-center gap-2 border-b pb-2 text-sm">
                    <Checkbox
                      checked={allIncluded}
                      onCheckedChange={(checked) => toggleAllIncluded(!!checked)}
                    />
                    {tTable("selectAll")}
                  </label>
                  <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                    {matchedStudents.map((student) => (
                      <label
                        key={student.id}
                        className="flex items-center gap-2 rounded-md p-1.5 text-sm hover:bg-accent"
                      >
                        <Checkbox
                          checked={!exceptIds.has(student.id)}
                          onCheckedChange={(checked) =>
                            toggleIncluded(student.id, !!checked)
                          }
                        />
                        {locale === "ar" ? student.name_ar : student.name_en}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <Section title={t("toHeading")}>
            <SelectField
              control={control}
              name="to.stage_id"
              label={tWizard("stageLabel")}
              placeholder={tWizard("stagePlaceholder")}
              options={stageOptions}
              onSelect={() => {
                form.setValue("to.grade_id", "");
                form.setValue("to.classroom_id", "");
              }}
            />
            <SelectField
              control={control}
              name="to.grade_id"
              label={tWizard("gradeLabel")}
              placeholder={tWizard("gradePlaceholder")}
              options={toGradeOptions}
              disabled={!toStageId}
              onSelect={() => form.setValue("to.classroom_id", "")}
            />
            <SelectField
              control={control}
              name="to.classroom_id"
              label={tWizard("classroomLabel")}
              placeholder={tWizard("classroomPlaceholder")}
              options={toClassroomOptions}
              disabled={!toGradeId}
            />
            <SelectField
              control={control}
              name="to.academic_year_id"
              label={tWizard("academicYearLabel")}
              placeholder={tWizard("academicYearPlaceholder")}
              options={academicYearOptions}
            />
          </Section>

          <Button
            type="submit"
            disabled={includedCount === 0 || promoteMutation.isPending}
            className="self-start"
          >
            {promoteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("promoteButton", { count: includedCount })}
          </Button>
        </form>
      </Form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirmTitle")}
        description={t("confirmDescription", {
          count: includedCount,
          classroom: targetClassroomLabel,
        })}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        isLoading={promoteMutation.isPending}
        onConfirm={() => promoteMutation.mutate(form.getValues())}
      />
    </main>
  );
}
