"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageLoader } from "@/components/page-loader";
import { Section, GuardianFields, type Option } from "@/features/students/guardian-fields";
import {
  createStudentGuardiansSchema,
  studentGuardiansDefaults,
  toGuardiansPayload,
  type StudentGuardiansValues,
} from "./schema";
import type { Student } from "./types";
import type {
  BloodTypeType,
  GovernorateType,
  NationalityType,
  ReligionType,
} from "@/types/generated";

const KNOWN_FIELDS = [
  "father.name", "father.job", "father.national_id", "father.phone",
  "father.nationality_id", "father.governorate_id", "father.blood_type_id",
  "father.religion_id", "father.address",
  "mother.name", "mother.job", "mother.national_id", "mother.phone",
  "mother.nationality_id", "mother.governorate_id", "mother.blood_type_id",
  "mother.religion_id", "mother.address",
] as const;

type TabValue = "overview" | "father" | "mother";

function bilingual(locale: string, item: { name_en: string; name_ar: string }) {
  return locale === "ar" ? item.name_ar : item.name_en;
}

function toOptions(
  locale: string,
  items: { id: number; name_en: string; name_ar: string }[]
): Option[] {
  return items.map((item) => ({
    value: String(item.id),
    label: bilingual(locale, item),
  }));
}

function ReadOnlyStudentSummary({ student }: { student: Student }) {
  const t = useTranslations("StudentWizard");
  const locale = useLocale();

  return (
    <Section title={t("sectionPersonalInfo")}>
      <p className="text-sm">
        {student.name_en} / {student.name_ar}
      </p>
      <p className="text-sm text-muted-foreground">{student.email}</p>
      <p className="text-sm text-muted-foreground">
        {bilingual(locale, student.nationality)} {" · "}
        {bilingual(locale, student.governorate)} {" · "}
        {bilingual(locale, student.blood_type)}
      </p>
      <p className="text-sm text-muted-foreground">
        {bilingual(locale, student.stage)} {" · "}
        {bilingual(locale, student.grade)} {" · "}
        {student.classroom.name} {" · "}
        {bilingual(locale, student.academic_year)}
      </p>

      {student.attachments.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-2">
          {student.attachments.map((attachment) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={attachment.id}
              src={attachment.url}
              alt={attachment.name}
              className="h-20 w-20 rounded-md border object-cover"
            />
          ))}
        </div>
      )}
    </Section>
  );
}

function StudentPanel({ student }: { student: Student }) {
  const t = useTranslations("ParentPortal");
  const tWizard = useTranslations("StudentWizard");
  const tValidation = useTranslations("Validation");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabValue>("overview");

  const schema = useMemo(
    () => createStudentGuardiansSchema(tValidation),
    [tValidation]
  );

  const form = useForm<StudentGuardiansValues>({
    resolver: zodResolver(schema),
    defaultValues: studentGuardiansDefaults(student),
  });

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

  const fatherGovernorates = useGovernorates(fatherNationalityId);
  const motherGovernorates = useGovernorates(motherNationalityId);

  const nationalityOptions = toOptions(locale, nationalitiesData ?? []);
  const bloodTypeOptions = toOptions(locale, bloodTypesData ?? []);
  const religionOptions = toOptions(locale, religionsData ?? []);

  const mutation = useMutation({
    mutationFn: (values: StudentGuardiansValues) =>
      apiFetch<{ student: Student }>("/api/parent/student", {
        method: "PUT",
        body: JSON.stringify(toGuardiansPayload(values)),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["parent-student"], data.student);
      toast.success(t("guardiansUpdated"));
    },
    onError: (err) => {
      const message = applyServerErrors(
        form,
        err,
        KNOWN_FIELDS,
        t("guardiansUpdateError")
      );
      if (message) toast.error(message);
    },
  });

  function onInvalid() {
    for (const field of KNOWN_FIELDS) {
      if (form.getFieldState(field, form.formState).invalid) {
        setActiveTab(field.startsWith("father.") ? "father" : "mother");
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
          className="flex flex-col gap-4"
        >
          <TabsList>
            <TabsTrigger value="overview">{t("overviewTab")}</TabsTrigger>
            <TabsTrigger value="father">{tWizard("stepFather")}</TabsTrigger>
            <TabsTrigger value="mother">{tWizard("stepMother")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <ReadOnlyStudentSummary student={student} />
          </TabsContent>

          <TabsContent value="father">
            <GuardianFields
              control={form.control}
              prefix="father"
              nationalities={nationalityOptions}
              bloodTypes={bloodTypeOptions}
              religions={religionOptions}
              governorateOptions={toOptions(locale, fatherGovernorates)}
            />
          </TabsContent>

          <TabsContent value="mother">
            <GuardianFields
              control={form.control}
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
          {mutation.isPending ? t("saving") : t("saveGuardians")}
        </Button>
      </form>
    </Form>
  );
}

export function StudentInfo() {
  const t = useTranslations("ParentPortal");

  const { data, isLoading, error } = useQuery({
    queryKey: ["parent-student"],
    queryFn: () =>
      apiFetch<{ student: Student }>("/api/parent/student").then(
        (d) => d.student
      ),
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  if (isLoading) return <PageLoader />;
  if (!data) return null;

  return <StudentPanel student={data} />;
}
