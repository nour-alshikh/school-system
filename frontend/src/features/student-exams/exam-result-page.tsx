"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/page-loader";
import type { StudentExamListEntry } from "./types";

export function ExamResultPage({ id }: { id: string }) {
  const t = useTranslations("ExamResultPage");
  const { user, isLoading: isAuthLoading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace(`/login?redirect=/my-exams/${id}/result`);
    }
  }, [isAuthLoading, user, router, id]);

  useEffect(() => {
    if (!isAuthLoading && user && !hasRole("student")) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, hasRole, router]);

  // No dedicated "result" endpoint — the list already carries this
  // student's score once submitted (see StudentExamListEntryType), so
  // reusing it here avoids a second backend surface just for this page.
  const {
    data: exams,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["student-exams"],
    queryFn: () =>
      apiFetch<{ exams: StudentExamListEntry[] }>("/api/student/exams").then((d) => d.exams),
    enabled: !isAuthLoading && !!user && hasRole("student"),
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const exam = exams?.find((e) => String(e.id) === id);

  useEffect(() => {
    if (!exams || !exam) return;
    if (exam.attempt_status !== "submitted") {
      router.replace(`/my-exams/${id}`);
    }
  }, [exams, exam, id, router]);

  if (isAuthLoading || !user || isLoading || !exam || exam.attempt_status !== "submitted") {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h2 className="text-lg font-semibold">{exam.title}</h2>
      <p className="text-sm text-muted-foreground">{t("submitted")}</p>
      <p className="text-4xl font-bold">
        {exam.score ?? 0}
        <span className="text-lg font-normal text-muted-foreground">/{exam.total_marks}</span>
      </p>
      <Button nativeButton={false} render={<Link href="/my-exams" />}>{t("backToList")}</Button>
    </main>
  );
}
