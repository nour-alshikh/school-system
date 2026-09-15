"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { PageLoader } from "@/components/page-loader";
import { StudentWizard } from "./student-wizard";

export function StudentCreatePage() {
  const t = useTranslations("StudentsPage");
  const { user, isLoading, can } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login?redirect=/students/new");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!isLoading && user && !can("manage-students")) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, can, router]);

  if (isLoading || !user || !can("manage-students")) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <h1 className="text-lg font-semibold">{t("createHeading")}</h1>
      <StudentWizard />
    </main>
  );
}
