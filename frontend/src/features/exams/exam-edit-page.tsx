"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PageLoader } from "@/components/page-loader";
import { ExamForm } from "./exam-form";
import type { Exam } from "./types";

export function ExamEditPage({ id }: { id: string }) {
  const t = useTranslations("ExamFormPage");
  const { user, isLoading: isAuthLoading, can, hasRole } = useAuth();
  const router = useRouter();

  const canAccess = can("manage-exams") || hasRole("teacher");

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace(`/login?redirect=/exams/${id}`);
    }
  }, [isAuthLoading, user, router, id]);

  useEffect(() => {
    if (!isAuthLoading && user && !canAccess) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, canAccess, router]);

  const { data: exam, isLoading, error } = useQuery({
    queryKey: ["exams", id],
    queryFn: () => apiFetch<{ exam: Exam }>(`/api/exams/${id}`).then((d) => d.exam),
    enabled: !isAuthLoading && !!user && canAccess,
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  if (isAuthLoading || !user || !canAccess || isLoading || !exam) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <h2 className="text-lg font-semibold">{t("editHeading")}</h2>
      <ExamForm key={exam.id} exam={exam} onSuccess={() => router.push("/exams")} />
    </main>
  );
}
