"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageLoader } from "@/components/page-loader";
import type { StudentExamAttempt } from "./types";

function formatRemaining(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function TakeExamPage({ id }: { id: string }) {
  const t = useTranslations("TakeExamPage");
  const tErrors = useTranslations("Errors");
  const { user, isLoading: isAuthLoading, hasRole } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [answers, setAnswers] = useState<Record<number, number | null>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const initializedRef = useRef(false);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace(`/login?redirect=/my-exams/${id}`);
    }
  }, [isAuthLoading, user, router, id]);

  useEffect(() => {
    if (!isAuthLoading && user && !hasRole("student")) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, hasRole, router]);

  const {
    data: attempt,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["student-exam-attempt", id],
    queryFn: () =>
      apiFetch<{ attempt: StudentExamAttempt }>(`/api/student/exams/${id}`).then((d) => d.attempt),
    enabled: !isAuthLoading && !!user && hasRole("student"),
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Starting the attempt (or an already-submitted/expired one) can fail —
  // 409 means it's already finished (this call, or a prior visit, just
  // finalized it), anything else is a hard block. Either way there's
  // nothing to take anymore, so bounce back to the list rather than
  // stranding the student on a broken page.
  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
    router.replace("/my-exams");
  }, [error, router, t]);

  // Seed local answer state and the countdown once, from the server's
  // clock-derived remaining_seconds — never re-seeded on refetch, so the
  // countdown doesn't jump around if react-query refires this query.
  useEffect(() => {
    if (!attempt || initializedRef.current) return;
    initializedRef.current = true;

    setAnswers(
      Object.fromEntries(attempt.questions.map((q) => [q.id, q.selected_option_id ?? null]))
    );
    setRemainingSeconds(attempt.remaining_seconds);
  }, [attempt]);

  const submitMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ result: unknown }>(`/api/student/exams/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          records: Object.entries(answers).map(([questionId, selectedOptionId]) => ({
            question_id: Number(questionId),
            selected_option_id: selectedOptionId,
          })),
        }),
      }),
    onSuccess: async () => {
      // Awaited: the result page reads this same query's cache to confirm
      // attempt_status is "submitted" before rendering (see
      // exam-result-page.tsx). Navigating before the refetch lands means it
      // reads pre-submit data and bounces straight back here.
      await queryClient.invalidateQueries({ queryKey: ["student-exams"], exact: false });
      router.push(`/my-exams/${id}/result`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : tErrors("somethingWentWrong"));
    },
  });

  // Countdown ticks client-side; at zero, submits automatically exactly
  // once with whatever's answered so far — the server independently
  // enforces the real deadline (see StudentPortal\ExamController), this is
  // just UX so a student doesn't have to click submit under time pressure.
  useEffect(() => {
    if (remainingSeconds === null) return;
    if (remainingSeconds <= 0) {
      if (!autoSubmittedRef.current && !submitMutation.isPending) {
        autoSubmittedRef.current = true;
        submitMutation.mutate();
      }
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => (prev === null ? prev : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds]);

  if (isAuthLoading || !user || isLoading || !attempt || remainingSeconds === null) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{attempt.title}</h2>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary" dir="ltr">
            {formatRemaining(remainingSeconds)}
          </span>
        </div>

        {attempt.instructions && (
          <p className="text-sm text-muted-foreground">{attempt.instructions}</p>
        )}

        <div className="flex flex-col gap-4">
          {attempt.questions.map((question, index) => (
            <div key={question.id} className="flex flex-col gap-3 rounded-lg border p-4">
              <p className="text-sm font-medium">
                {t("questionNumber", { number: index + 1 })}. {question.text}
              </p>
              <RadioGroup
                value={answers[question.id] != null ? String(answers[question.id]) : ""}
                onValueChange={(value) =>
                  setAnswers((prev) => ({ ...prev, [question.id]: value ? Number(value) : null }))
                }
                className="flex flex-col gap-2"
              >
                {question.options.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value={String(option.id)} />
                    {option.text}
                  </label>
                ))}
              </RadioGroup>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            disabled={submitMutation.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {submitMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("submit")}
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirmTitle")}
        description={t("confirmDescription")}
        confirmLabel={t("submit")}
        cancelLabel={t("cancel")}
        isLoading={submitMutation.isPending}
        onConfirm={() => {
          setConfirmOpen(false);
          submitMutation.mutate();
        }}
      />
    </main>
  );
}
