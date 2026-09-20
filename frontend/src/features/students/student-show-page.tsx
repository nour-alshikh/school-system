"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Link, useRouter } from "@/i18n/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageLoader } from "@/components/page-loader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Section } from "./guardian-fields";
import { StudentEditForm } from "./student-edit-form";
import { StudentFeesSection } from "@/features/fee-charges/student-fees-section";
import type { Student, Guardian } from "./types";
import type {
  BloodTypeType,
  GovernorateType,
  NationalityType,
  ReligionType,
} from "@/types/generated";

function bilingual(locale: string, item: { name_en: string; name_ar: string }) {
  return locale === "ar" ? item.name_ar : item.name_en;
}

function findLabel(
  locale: string,
  items: { id: number; name_en: string; name_ar: string }[],
  id: number
) {
  const item = items.find((i) => i.id === id);
  return item ? bilingual(locale, item) : "—";
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}

type TabValue =
  | "student"
  | "academic"
  | "parent"
  | "father"
  | "mother"
  | "attachments"
  | "fees";

function GuardianTab({
  guardian,
  nationalities,
  bloodTypes,
  religions,
  governorates,
}: {
  guardian: Guardian;
  nationalities: NationalityType[];
  bloodTypes: BloodTypeType[];
  religions: ReligionType[];
  governorates: GovernorateType[];
}) {
  const t = useTranslations("StudentWizard");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-6">
      <Section title={t("sectionPersonalInfo")}>
        <dl className="grid grid-cols-2 gap-4">
          <Field label={t("guardianNameLabel")} value={guardian.name} />
          <Field label={t("guardianJobLabel")} value={guardian.job} />
          <Field label={t("guardianNationalIdLabel")} value={guardian.national_id} />
          <Field label={t("guardianPhoneLabel")} value={guardian.phone} />
        </dl>
      </Section>

      <Section title={t("sectionLocation")}>
        <dl className="grid grid-cols-2 gap-4">
          <Field
            label={t("guardianNationalityLabel")}
            value={findLabel(locale, nationalities, guardian.nationality_id)}
          />
          <Field
            label={t("guardianGovernorateLabel")}
            value={findLabel(locale, governorates, guardian.governorate_id)}
          />
          <Field
            label={t("guardianBloodTypeLabel")}
            value={findLabel(locale, bloodTypes, guardian.blood_type_id)}
          />
          <Field
            label={t("guardianReligionLabel")}
            value={findLabel(locale, religions, guardian.religion_id)}
          />
        </dl>
      </Section>

      <Section title={t("sectionAddress")}>
        <p className="text-sm">{guardian.address || "—"}</p>
      </Section>
    </div>
  );
}

function StudentDetail({
  student,
  canManageFees,
}: {
  student: Student;
  canManageFees: boolean;
}) {
  const t = useTranslations("StudentWizard");
  const tShow = useTranslations("StudentShowPage");
  const tPage = useTranslations("StudentsPage");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabValue>("student");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  function useGovernorates(nationalityId: number) {
    return useQuery({
      queryKey: ["governorates", String(nationalityId)],
      queryFn: () =>
        apiFetch<{ governorates: GovernorateType[] }>(
          `/api/governorates?nationality_id=${nationalityId}`
        ).then((d) => d.governorates),
      enabled: !!nationalityId,
    }).data ?? [];
  }

  const fatherGovernorates = useGovernorates(student.father.nationality_id);
  const motherGovernorates = useGovernorates(student.mother.nationality_id);

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>(`/api/students/${student.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"], exact: false });
      toast.success(tPage("deleteSuccess"));
      router.push("/students");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : tPage("deleteError"));
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/students"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {tShow("backToStudents")}
        </Link>

        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">
            {locale === "ar" ? student.name_ar : student.name_en}
          </h1>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-4" />
              {tPage("edit")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteOpen(true)}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {tPage("delete")}
            </Button>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
        className="flex flex-col gap-4"
      >
        <TabsList>
          <TabsTrigger value="student">{t("stepPersonal")}</TabsTrigger>
          <TabsTrigger value="academic">{t("stepAcademic")}</TabsTrigger>
          <TabsTrigger value="parent">{t("stepParentAccount")}</TabsTrigger>
          <TabsTrigger value="father">{t("stepFather")}</TabsTrigger>
          <TabsTrigger value="mother">{t("stepMother")}</TabsTrigger>
          <TabsTrigger value="attachments">{t("stepAttachments")}</TabsTrigger>
          {canManageFees && (
            <TabsTrigger value="fees">{tShow("feesTab")}</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="student">
          <Section title={t("sectionPersonalInfo")}>
            <dl className="grid grid-cols-2 gap-4">
              <Field label={t("studentNameEnLabel")} value={student.name_en} />
              <Field label={t("studentNameArLabel")} value={student.name_ar} />
              <Field
                label={t("genderLabel")}
                value={
                  student.gender === "male" ? t("genderMale") : t("genderFemale")
                }
              />
            </dl>
          </Section>

          <Section title={t("sectionLocation")}>
            <dl className="grid grid-cols-2 gap-4">
              <Field
                label={t("nationalityLabel")}
                value={bilingual(locale, student.nationality)}
              />
              <Field
                label={t("governorateLabel")}
                value={bilingual(locale, student.governorate)}
              />
              <Field
                label={t("bloodTypeLabel")}
                value={bilingual(locale, student.blood_type)}
              />
            </dl>
          </Section>

          <Section title={t("sectionAccount")}>
            <dl className="grid grid-cols-2 gap-4">
              <Field label={t("studentEmailLabel")} value={student.email} />
            </dl>
          </Section>
        </TabsContent>

        <TabsContent value="academic">
          <Section title={t("sectionAcademicAssignment")}>
            <dl className="grid grid-cols-2 gap-4">
              <Field label={t("stageLabel")} value={bilingual(locale, student.stage)} />
              <Field label={t("gradeLabel")} value={bilingual(locale, student.grade)} />
              <Field label={t("classroomLabel")} value={student.classroom.name} />
              <Field
                label={t("academicYearLabel")}
                value={bilingual(locale, student.academic_year)}
              />
            </dl>
          </Section>
        </TabsContent>

        <TabsContent value="parent">
          <Section title={t("sectionAccount")}>
            <dl className="grid grid-cols-2 gap-4">
              <Field label={t("parentEmailLabel")} value={student.parent_email} />
            </dl>
          </Section>
        </TabsContent>

        <TabsContent value="father">
          <GuardianTab
            guardian={student.father}
            nationalities={nationalitiesData ?? []}
            bloodTypes={bloodTypesData ?? []}
            religions={religionsData ?? []}
            governorates={fatherGovernorates}
          />
        </TabsContent>

        <TabsContent value="mother">
          <GuardianTab
            guardian={student.mother}
            nationalities={nationalitiesData ?? []}
            bloodTypes={bloodTypesData ?? []}
            religions={religionsData ?? []}
            governorates={motherGovernorates}
          />
        </TabsContent>

        <TabsContent value="attachments">
          <Section title={t("sectionAttachments")}>
            {student.attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tShow("attachmentsNone")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {student.attachments.map((attachment) => (
                  <div key={attachment.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="h-24 w-24 rounded-md border object-cover"
                    />
                    <a
                      href={`/api/students/${student.id}/attachments/${attachment.id}/download`}
                      download
                      aria-label={tShow("download")}
                      title={tShow("download")}
                      className="absolute inset-x-0 bottom-0 flex items-center justify-center rounded-b-md bg-background/80 p-1 text-foreground hover:bg-muted"
                    >
                      <Download className="size-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </TabsContent>

        {canManageFees && (
          <TabsContent value="fees">
            <StudentFeesSection student={student} />
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] sm:max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tPage("editStudent")}</DialogTitle>
          </DialogHeader>
          <StudentEditForm
            key={student.id}
            student={student}
            onSuccess={() => {
              setEditOpen(false);
              queryClient.invalidateQueries({
                queryKey: ["student", String(student.id)],
              });
            }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={tPage("confirmDeleteTitle")}
        description={tPage("confirmDeleteDescription", {
          name: locale === "ar" ? student.name_ar : student.name_en,
        })}
        confirmLabel={tPage("delete")}
        cancelLabel={tPage("cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </main>
  );
}

export function StudentShowPage({ id }: { id: string }) {
  const t = useTranslations("StudentShowPage");
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();
  const canManage = can("manage-students");
  const canManageFees = can("manage-fees");

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace(`/login?redirect=/students/${id}`);
    }
  }, [isAuthLoading, user, router, id]);

  useEffect(() => {
    if (!isAuthLoading && user && !canManage) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, canManage, router]);

  const { data: student, error } = useQuery({
    queryKey: ["student", id],
    queryFn: () =>
      apiFetch<{ student: Student }>(`/api/students/${id}`).then(
        (d) => d.student
      ),
    enabled: !isAuthLoading && !!user && canManage,
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
    router.replace("/students");
  }, [error, t, router]);

  if (isAuthLoading || !user || !canManage || !student) {
    return <PageLoader />;
  }

  return <StudentDetail student={student} canManageFees={canManageFees} />;
}
