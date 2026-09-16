"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Section, SelectField, GuardianFields, type Option } from "./guardian-fields";
import {
  createEditStudentSchema,
  editStudentDefaults,
  toEditPayload,
  type EditStudentValues,
} from "./schema";
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

const KNOWN_FIELDS = [
  "student.name_en", "student.name_ar", "student.email", "student.password",
  "student.password_confirmation", "student.gender", "student.nationality_id",
  "student.governorate_id", "student.blood_type_id", "student.stage_id",
  "student.grade_id", "student.classroom_id", "student.academic_year_id",
  "parent.email", "parent.password", "parent.password_confirmation",
  "father.name", "father.job", "father.national_id", "father.phone",
  "father.nationality_id", "father.governorate_id", "father.blood_type_id",
  "father.religion_id", "father.address",
  "mother.name", "mother.job", "mother.national_id", "mother.phone",
  "mother.nationality_id", "mother.governorate_id", "mother.blood_type_id",
  "mother.religion_id", "mother.address",
] as const;

function toOptions(
  locale: string,
  items: { id: number; name_en: string; name_ar: string }[]
): Option[] {
  return items.map((item) => ({
    value: String(item.id),
    label: locale === "ar" ? item.name_ar : item.name_en,
  }));
}

type TabValue = "student" | "academic" | "parent" | "father" | "mother";

// Where a field's error surfaces so an invalid submit can flip to the right
// tab — otherwise the message renders on a panel the admin isn't looking at.
function tabForField(field: (typeof KNOWN_FIELDS)[number]): TabValue {
  if (field.startsWith("parent.")) return "parent";
  if (field.startsWith("father.")) return "father";
  if (field.startsWith("mother.")) return "mother";
  if (
    field === "student.stage_id" ||
    field === "student.grade_id" ||
    field === "student.classroom_id" ||
    field === "student.academic_year_id"
  ) {
    return "academic";
  }
  return "student";
}

export function StudentEditForm({
  student,
  onSuccess,
}: {
  student: Student;
  onSuccess?: () => void;
}) {
  const t = useTranslations("StudentWizard");
  const tValidation = useTranslations("Validation");
  const tPage = useTranslations("StudentsPage");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabValue>("student");

  const schema = useMemo(() => createEditStudentSchema(tValidation), [tValidation]);

  const form = useForm<EditStudentValues>({
    resolver: zodResolver(schema),
    defaultValues: editStudentDefaults(student),
  });

  const { control } = form;

  const stageId = form.watch("student.stage_id");
  const gradeId = form.watch("student.grade_id");
  const studentNationalityId = form.watch("student.nationality_id");
  const fatherNationalityId = form.watch("father.nationality_id");
  const motherNationalityId = form.watch("mother.nationality_id");

  const { data: nationalitiesData } = useQuery({
    queryKey: ["nationalities"],
    queryFn: () =>
      apiFetch<{ nationalities: NationalityType[] }>("/api/nationalities").then(
        (d) => d.nationalities
      ),
  });
  const { data: bloodTypesData } = useQuery({
    queryKey: ["blood-types"],
    queryFn: () =>
      apiFetch<{ blood_types: BloodTypeType[] }>("/api/blood-types").then(
        (d) => d.blood_types
      ),
  });
  const { data: religionsData } = useQuery({
    queryKey: ["religions"],
    queryFn: () =>
      apiFetch<{ religions: ReligionType[] }>("/api/religions").then(
        (d) => d.religions
      ),
  });
  const { data: stagesData } = useQuery({
    queryKey: ["stages"],
    queryFn: () =>
      apiFetch<{ stages: StageType[] }>("/api/stages").then((d) => d.stages),
  });
  const { data: academicYearsData } = useQuery({
    queryKey: ["academic-years-all"],
    queryFn: () =>
      apiFetch<{ academic_years: AcademicYearType[] }>(
        "/api/academic-years"
      ).then((d) => d.academic_years),
  });
  const { data: gradesData } = useQuery({
    queryKey: ["grades", "stage", stageId],
    queryFn: () =>
      apiFetch<{ grades: GradeType[] }>(`/api/grades?stage_id=${stageId}`).then(
        (d) => d.grades
      ),
    enabled: !!stageId,
  });
  const { data: classroomsData } = useQuery({
    queryKey: ["classrooms", "grade", gradeId],
    queryFn: () =>
      apiFetch<{ classrooms: ClassroomType[] }>(
        `/api/classrooms?grade_id=${gradeId}`
      ).then((d) => d.classrooms),
    enabled: !!gradeId,
  });

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

  const nationalityOptions = toOptions(locale, nationalitiesData ?? []);
  const bloodTypeOptions = toOptions(locale, bloodTypesData ?? []);
  const religionOptions = toOptions(locale, religionsData ?? []);
  const stageOptions = toOptions(locale, stagesData ?? []);
  const gradeOptions = toOptions(locale, gradesData ?? []);
  const academicYearOptions = toOptions(locale, academicYearsData ?? []);
  const classroomOptions = (classroomsData ?? []).map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  const mutation = useMutation({
    mutationFn: (values: EditStudentValues) =>
      apiFetch<{ student: Student }>(`/api/students/${student.id}`, {
        method: "PUT",
        body: JSON.stringify(toEditPayload(values)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"], exact: false });
      toast.success(tPage("updateSuccess"));
      onSuccess?.();
    },
    onError: (err) => {
      const message = applyServerErrors(form, err, KNOWN_FIELDS, tPage("updateError"));
      if (message) toast.error(message);
    },
  });

  function onInvalid() {
    for (const field of KNOWN_FIELDS) {
      if (form.getFieldState(field, form.formState).invalid) {
        setActiveTab(tabForField(field));
        return;
      }
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => mutation.mutate(v), onInvalid)}
        className="flex flex-col gap-6"
      >
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabValue)}
        >
          <TabsList>
            <TabsTrigger value="student">{t("stepPersonal")}</TabsTrigger>
            <TabsTrigger value="academic">{t("stepAcademic")}</TabsTrigger>
            <TabsTrigger value="parent">{t("stepParentAccount")}</TabsTrigger>
            <TabsTrigger value="father">{t("stepFather")}</TabsTrigger>
            <TabsTrigger value="mother">{t("stepMother")}</TabsTrigger>
          </TabsList>

          <TabsContent value="student">
            <Section title={t("sectionPersonalInfo")}>
              <FormField
                control={control}
                name="student.name_en"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("studentNameEnLabel")}</FormLabel>
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
                  <FormItem>
                    <FormLabel>{t("studentNameArLabel")}</FormLabel>
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
                options={toOptions(locale, studentGovernorates)}
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
                    <FormLabel>{tPage("newPasswordLabel")}</FormLabel>
                    <FormControl>
                      <PasswordInput {...field} className="h-10" />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {tPage("newPasswordHint")}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="student.password_confirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("studentPasswordConfirmationLabel")}</FormLabel>
                    <FormControl>
                      <PasswordInput {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Section>
          </TabsContent>

          <TabsContent value="academic">
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
          </TabsContent>

          <TabsContent value="parent">
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
                    <FormLabel>{tPage("newPasswordLabel")}</FormLabel>
                    <FormControl>
                      <PasswordInput {...field} className="h-10" />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {tPage("newPasswordHint")}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="parent.password_confirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("parentPasswordConfirmationLabel")}</FormLabel>
                    <FormControl>
                      <PasswordInput {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Section>
          </TabsContent>

          <TabsContent value="father">
            <GuardianFields
              control={control}
              prefix="father"
              nationalities={nationalityOptions}
              bloodTypes={bloodTypeOptions}
              religions={religionOptions}
              governorateOptions={toOptions(locale, fatherGovernorates)}
            />
          </TabsContent>

          <TabsContent value="mother">
            <GuardianFields
              control={control}
              prefix="mother"
              nationalities={nationalityOptions}
              bloodTypes={bloodTypeOptions}
              religions={religionOptions}
              governorateOptions={toOptions(locale, motherGovernorates)}
            />
          </TabsContent>
        </Tabs>

        <Button type="submit" disabled={mutation.isPending} className="self-start">
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          {mutation.isPending ? tPage("saving") : tPage("saveChanges")}
        </Button>
      </form>
    </Form>
  );
}
