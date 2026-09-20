"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { PageLoader } from "@/components/page-loader";
import { ExamForm } from "./exam-form";

export function ExamCreatePage() {
  const t = useTranslations("ExamFormPage");
  const { user, isLoading: isAuthLoading, can, hasRole } = useAuth();
  const router = useRouter();

  const canAccess = can("manage-exams") || hasRole("teacher");

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/exams/new");
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!isAuthLoading && user && !canAccess) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, canAccess, router]);

  if (isAuthLoading || !user || !canAccess) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <h2 className="text-lg font-semibold">{t("createHeading")}</h2>
      <ExamForm onSuccess={() => router.push("/exams")} />
    </main>
  );
}
