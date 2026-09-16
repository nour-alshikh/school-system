"use client";

import { useEffect, useMemo, useState } from "react";
import type { Control } from "react-hook-form";
import { useTranslations, useLocale } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { LocaleTabs } from "@/components/locale-tabs";
import {
  createStudentWizardSchema,
  defaultStudentWizardValues,
  STEP_FIELDS,
  TOTAL_STEPS,
  toFormData,
  type StudentWizardValues,
} from "./schema";
import {
  Section,
  SelectField,
  GuardianFields,
  type Option,
} from "./guardian-fields";
import type { Student } from "./types";
import type {
  AcademicYearType,
  BloodTypeType,
  ClassroomType,
  GovernorateType,
  GradeType,
  NationalityType,
  ReligionType,
  StageType,
} from "@/types/generated";

function nameOf(locale: string, item: { name_en: string; name_ar: string }) {
  return locale === "ar" ? item.name_ar : item.name_en;
}

function findLabel(
  locale: string,
  items: { id: number; name_en: string; name_ar: string }[],
  id: string
) {
  const item = items.find((i) => String(i.id) === id);
  return item ? nameOf(locale, item) : "—";
}

function AttachmentPreviews({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => {
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [urls]);

  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 pt-2">
      {files.map((file, index) => (
        <div key={`${file.name}-${file.size}-${index}`} className="relative">
          <img
            src={urls[index]}
            alt={file.name}
            className="h-20 w-20 rounded-md border object-cover"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

const MAX_ATTACHMENT_SIZE = 1024 * 1024; // 1MB per image

function AttachmentsField({ control }: { control: Control<StudentWizardValues> }) {
  const t = useTranslations("StudentWizard");
  const tValidation = useTranslations("Validation");

  return (
    <FormField
      control={control}
      name="attachments"
      render={({ field }) => {
        const files = (field.value as File[] | undefined) ?? [];

        function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
          const picked = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (picked.length === 0) return;

          const accepted: File[] = [];
          for (const file of picked) {
            if (!file.type.startsWith("image/")) {
              toast.error(tValidation("attachmentImageOnly"));
            } else if (file.size > MAX_ATTACHMENT_SIZE) {
              toast.error(tValidation("attachmentTooLarge"));
            } else {
              accepted.push(file);
            }
          }
          if (accepted.length > 0) field.onChange([...files, ...accepted]);
        }

        function removeAt(index: number) {
          field.onChange(files.filter((_, i) => i !== index));
        }

        return (
          <FormItem>
            <FormLabel>{t("attachmentsLabel")}</FormLabel>
            <FormControl>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={handleChange}
                className="h-10"
              />
            </FormControl>
            <p className="text-xs text-muted-foreground">
              {t("attachmentsHint")}
            </p>
            <FormMessage />
            <AttachmentPreviews files={files} onRemove={removeAt} />
          </FormItem>
        );
      }}
    />
  );
}

export function StudentWizard({ onSuccess }: { onSuccess?: () => void }) {
  const t = useTranslations("StudentWizard");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();

  const [step, setStep] = useState(1);
  const [activeNameLocale, setActiveNameLocale] = useState<"en" | "ar">("en");

  const schema = useMemo(
    () => createStudentWizardSchema(tValidation),
    [tValidation]
  );

  const form = useForm<StudentWizardValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultStudentWizardValues,
  });

  const { control } = form;

  const studentNationalityId = form.watch("student.nationality_id");
  const fatherNationalityId = form.watch("father.nationality_id");
  const motherNationalityId = form.watch("mother.nationality_id");
  const stageId = form.watch("student.stage_id");
  const gradeId = form.watch("student.grade_id");

  const { data: nationalitiesData } = useQuery({
    queryKey: ["nationalities"],
    queryFn: () =>
      apiFetch<{ nationalities: NationalityType[] }>("/api/nationalities").then(
        (d) => d.nationalities
      ),
  });
  const nationalities = nationalitiesData ?? [];

  // Only one nationality is seeded today (Egyptian) — default every
  // nationality field to it and lock the select, rather than making the
  // admin pick the only option that exists.
  useEffect(() => {
    if (!nationalitiesData || nationalitiesData.length === 0) return;

    const defaultNationality =
      nationalitiesData.find((n) => n.name_en === "Egyptian") ??
      nationalitiesData[0];
    const id = String(defaultNationality.id);

    (
      [
        "student.nationality_id",
        "father.nationality_id",
        "mother.nationality_id",
      ] as const
    ).forEach((path) => {
      if (!form.getValues(path)) form.setValue(path, id);
    });
  }, [nationalitiesData, form]);

  const { data: bloodTypesData } = useQuery({
    queryKey: ["blood-types"],
    queryFn: () =>
      apiFetch<{ blood_types: BloodTypeType[] }>("/api/blood-types").then(
        (d) => d.blood_types
      ),
  });
  const bloodTypes = bloodTypesData ?? [];

  const { data: religionsData } = useQuery({
    queryKey: ["religions"],
    queryFn: () =>
      apiFetch<{ religions: ReligionType[] }>("/api/religions").then(
        (d) => d.religions
      ),
  });
  const religions = religionsData ?? [];

  const { data: stagesData } = useQuery({
    queryKey: ["stages"],
    queryFn: () =>
      apiFetch<{ stages: StageType[] }>("/api/stages").then((d) => d.stages),
  });
  const stages = stagesData ?? [];

  const { data: academicYearsData } = useQuery({
    queryKey: ["academic-years-all"],
    queryFn: () =>
      apiFetch<{ academic_years: AcademicYearType[] }>(
        "/api/academic-years"
      ).then((d) => d.academic_years),
  });
  const academicYears = academicYearsData ?? [];

  const { data: gradesData } = useQuery({
    queryKey: ["grades", "stage", stageId],
    queryFn: () =>
      apiFetch<{ grades: GradeType[] }>(`/api/grades?stage_id=${stageId}`).then(
        (d) => d.grades
      ),
    enabled: !!stageId,
  });
  const grades = gradesData ?? [];

  const { data: classroomsData } = useQuery({
    queryKey: ["classrooms", "grade", gradeId],
    queryFn: () =>
      apiFetch<{ classrooms: ClassroomType[] }>(
        `/api/classrooms?grade_id=${gradeId}`
      ).then((d) => d.classrooms),
    enabled: !!gradeId,
  });
  const classrooms = classroomsData ?? [];

  // Governorates are keyed by nationality, and three different selects
  // (student, father, mother) can each have a different nationality picked
  // at once — three fixed hook calls (never a variable count, which would
  // break React's rules of hooks), one per select. react-query dedupes the
  // underlying request whenever two of them share the same nationality id.
  function useGovernorates(nationalityId: string) {
    return useQuery({
      queryKey: ["governorates", nationalityId],
      queryFn: () =>
        apiFetch<{ governorates: GovernorateType[] }>(
          `/api/governorates?nationality_id=${nationalityId}`
        ).then((d) => d.governorates),
      enabled: !!nationalityId,
    }).data ?? [];
  }

  const studentGovernorates = useGovernorates(studentNationalityId);
  const fatherGovernorates = useGovernorates(fatherNationalityId);
  const motherGovernorates = useGovernorates(motherNationalityId);

  function toOptions(
    items: { id: number; name_en: string; name_ar: string }[]
  ): Option[] {
    return items.map((item) => ({
      value: String(item.id),
      label: nameOf(locale, item),
    }));
  }

  const nationalityOptions = toOptions(nationalities);
  const bloodTypeOptions = toOptions(bloodTypes);
  const religionOptions = toOptions(religions);
  const stageOptions = toOptions(stages);
  const gradeOptions = toOptions(grades);
  const classroomOptions = classrooms.map((c) => ({
    value: String(c.id),
    label: c.name,
  }));
  const academicYearOptions = toOptions(academicYears);

  const mutation = useMutation({
    mutationFn: (values: StudentWizardValues) =>
      apiFetch<{ student: Student }>("/api/students", {
        method: "POST",
        body: toFormData(values),
      }),
    onSuccess: () => {
      toast.success(t("successToast"));
      form.reset(defaultStudentWizardValues);
      setStep(1);
      onSuccess?.();
    },
    onError: (err) => {
      const remapped =
        err instanceof ApiError && err.errors
          ? new ApiError(err.status, err.message, {
              ...(err.errors["student.name.en"] && {
                "student.name_en": err.errors["student.name.en"],
              }),
              ...(err.errors["student.name.ar"] && {
                "student.name_ar": err.errors["student.name.ar"],
              }),
              ...Object.fromEntries(
                Object.entries(err.errors).filter(
                  ([field]) =>
                    field !== "student.name.en" && field !== "student.name.ar"
                )
              ),
            })
          : err;

      const knownFields = Object.values(STEP_FIELDS).flat();
      const message = applyServerErrors(
        form,
        remapped,
        knownFields,
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);

      jumpToFirstErrorStep();
    },
  });

  function jumpToFirstErrorStep() {
    if (
      form.getFieldState("student.name_en", form.formState).invalid &&
      activeNameLocale !== "en"
    ) {
      setActiveNameLocale("en");
    } else if (
      form.getFieldState("student.name_ar", form.formState).invalid &&
      activeNameLocale !== "ar"
    ) {
      setActiveNameLocale("ar");
    }

    for (const [stepNumber, fields] of Object.entries(STEP_FIELDS)) {
      const hasError = fields.some(
        (field) => form.getFieldState(field, form.formState).invalid
      );
      if (hasError) {
        setStep(Number(stepNumber));
        return;
      }
    }
  }

  async function goNext() {
    const fields = STEP_FIELDS[step];
    const valid = await form.trigger(fields);
    if (valid) setStep((s) => s + 1);
    else if (step === 1) {
      if (form.getFieldState("student.name_en", form.formState).invalid)
        setActiveNameLocale("en");
      else if (form.getFieldState("student.name_ar", form.formState).invalid)
        setActiveNameLocale("ar");
    }
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  function onInvalid() {
    jumpToFirstErrorStep();
  }

  const values = form.watch();

  const stepLabels = [
    t("stepPersonal"),
    t("stepAcademic"),
    t("stepParentAccount"),
    t("stepFather"),
    t("stepMother"),
    t("stepAttachments"),
    t("stepConfirm"),
  ];

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(
          (v) => mutation.mutate(v),
          () => onInvalid()
        )}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {t("stepOfTotal", { step, total: TOTAL_STEPS })}
          </p>
          <h2 className="text-lg font-semibold">{stepLabels[step - 1]}</h2>
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-6">
            <Section title={t("sectionPersonalInfo")}>
              <FormField
                control={control}
                name="student.name_en"
                render={({ field }) => (
                  <FormItem className={cn(activeNameLocale !== "en" && "hidden")}>
                    <div className="flex items-center justify-between">
                      <FormLabel>{t("studentNameEnLabel")}</FormLabel>
                      <LocaleTabs
                        value={activeNameLocale}
                        onChange={setActiveNameLocale}
                        errors={{
                          en: !!form.formState.errors.student?.name_en,
                          ar: !!form.formState.errors.student?.name_ar,
                        }}
                      />
                    </div>
                    <FormControl>
                      <Input {...field} dir="ltr" className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="student.name_ar"
                render={({ field }) => (
                  <FormItem className={cn(activeNameLocale !== "ar" && "hidden")}>
                    <div className="flex items-center justify-between">
                      <FormLabel>{t("studentNameArLabel")}</FormLabel>
                      <LocaleTabs
                        value={activeNameLocale}
                        onChange={setActiveNameLocale}
                        errors={{
                          en: !!form.formState.errors.student?.name_en,
                          ar: !!form.formState.errors.student?.name_ar,
                        }}
                      />
                    </div>
                    <FormControl>
                      <Input {...field} dir="rtl" className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <SelectField
                control={control}
                name="student.gender"
                label={t("genderLabel")}
                placeholder={t("genderPlaceholder")}
                options={[
                  { value: "male", label: t("genderMale") },
                  { value: "female", label: t("genderFemale") },
                ]}
              />
            </Section>

            <Section title={t("sectionLocation")}>
              <SelectField
                control={control}
                name="student.nationality_id"
                label={t("nationalityLabel")}
                placeholder={t("nationalityPlaceholder")}
                options={nationalityOptions}
                disabled
              />
              <SelectField
                control={control}
                name="student.governorate_id"
                label={t("governorateLabel")}
                placeholder={t("governoratePlaceholder")}
                options={toOptions(studentGovernorates)}
                disabled={!studentNationalityId}
              />
              <SelectField
                control={control}
                name="student.blood_type_id"
                label={t("bloodTypeLabel")}
                placeholder={t("bloodTypePlaceholder")}
                options={bloodTypeOptions}
              />
            </Section>

            <Section title={t("sectionAccount")}>
              <FormField
                control={control}
                name="student.email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("studentEmailLabel")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" dir="ltr" className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="student.password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("studentPasswordLabel")}</FormLabel>
                    <FormControl>
                      <PasswordInput {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="student.password_confirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("studentPasswordConfirmationLabel")}
                    </FormLabel>
                    <FormControl>
                      <PasswordInput {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Section>
          </div>
        )}

        {step === 2 && (
          <Section title={t("sectionAcademicAssignment")}>
            <SelectField
              control={control}
              name="student.stage_id"
              label={t("stageLabel")}
              placeholder={t("stagePlaceholder")}
              options={stageOptions}
              onSelect={() => {
                form.setValue("student.grade_id", "");
                form.setValue("student.classroom_id", "");
              }}
            />
            <SelectField
              control={control}
              name="student.grade_id"
              label={t("gradeLabel")}
              placeholder={t("gradePlaceholder")}
              options={gradeOptions}
              disabled={!stageId}
              onSelect={() => form.setValue("student.classroom_id", "")}
            />
            <SelectField
              control={control}
              name="student.classroom_id"
              label={t("classroomLabel")}
              placeholder={t("classroomPlaceholder")}
              options={classroomOptions}
              disabled={!gradeId}
            />
            <SelectField
              control={control}
              name="student.academic_year_id"
              label={t("academicYearLabel")}
              placeholder={t("academicYearPlaceholder")}
              options={academicYearOptions}
            />
          </Section>
        )}

        {step === 3 && (
          <Section title={t("sectionAccount")}>
            <FormField
              control={control}
              name="parent.email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("parentEmailLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" dir="ltr" className="h-10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="parent.password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("parentPasswordLabel")}</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} className="h-10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="parent.password_confirmation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("parentPasswordConfirmationLabel")}
                  </FormLabel>
                  <FormControl>
                    <PasswordInput {...field} className="h-10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Section>
        )}

        {step === 4 && (
          <GuardianFields
            control={control}
            prefix="father"
            nationalities={nationalityOptions}
            bloodTypes={bloodTypeOptions}
            religions={religionOptions}
            governorateOptions={toOptions(fatherGovernorates)}
          />
        )}

        {step === 5 && (
          <GuardianFields
            control={control}
            prefix="mother"
            nationalities={nationalityOptions}
            bloodTypes={bloodTypeOptions}
            religions={religionOptions}
            governorateOptions={toOptions(motherGovernorates)}
          />
        )}

        {step === 6 && (
          <Section title={t("sectionAttachments")}>
            <AttachmentsField control={control} />
          </Section>
        )}

        {step === 7 && (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground">
              {t("confirmDescription")}
            </p>

            <div className="flex flex-col gap-1">
              <h3 className="font-medium">{t("confirmStudentSection")}</h3>
              <p className="text-sm">
                {values.student.name_en} / {values.student.name_ar}
              </p>
              <p className="text-sm text-muted-foreground">
                {values.student.email}
              </p>
              <p className="text-sm text-muted-foreground">
                {findLabel(locale, nationalities, values.student.nationality_id)}
                {" · "}
                {findLabel(
                  locale,
                  studentGovernorates,
                  values.student.governorate_id
                )}
                {" · "}
                {findLabel(locale, bloodTypes, values.student.blood_type_id)}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="font-medium">{t("confirmAcademicSection")}</h3>
              <p className="text-sm text-muted-foreground">
                {findLabel(locale, stages, values.student.stage_id)}
                {" · "}
                {findLabel(locale, grades, values.student.grade_id)}
                {" · "}
                {classrooms.find(
                  (c) => String(c.id) === values.student.classroom_id
                )?.name ?? "—"}
                {" · "}
                {findLabel(
                  locale,
                  academicYears,
                  values.student.academic_year_id
                )}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="font-medium">{t("confirmParentSection")}</h3>
              <p className="text-sm text-muted-foreground">
                {values.parent.email}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="font-medium">{t("confirmFatherSection")}</h3>
              <p className="text-sm text-muted-foreground">
                {values.father.name} · {values.father.job} ·{" "}
                {values.father.phone}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="font-medium">{t("confirmMotherSection")}</h3>
              <p className="text-sm text-muted-foreground">
                {values.mother.name} · {values.mother.job} ·{" "}
                {values.mother.phone}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="font-medium">{t("confirmAttachmentsSection")}</h3>
              <p className="text-sm text-muted-foreground">
                {(values.attachments?.length ?? 0) > 0
                  ? t("confirmAttachmentsCount", {
                      count: values.attachments?.length ?? 0,
                    })
                  : t("confirmAttachmentsNone")}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {step > 1 && (
            <Button type="button" variant="outline" onClick={goBack}>
              {t("back")}
            </Button>
          )}
          {step < TOTAL_STEPS && (
            <Button type="button" onClick={goNext}>
              {t("next")}
            </Button>
          )}
          {step === TOTAL_STEPS && (
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {mutation.isPending ? t("submitting") : t("submit")}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
