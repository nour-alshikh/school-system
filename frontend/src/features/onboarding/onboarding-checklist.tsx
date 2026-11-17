"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Circle, Sparkles, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { OnboardingType } from "@/types/generated";

const QUERY_KEY = ["admin-onboarding"];

/** Where each step is done, in the order the checklist shows them. */
const STEP_HREFS: Record<string, string> = {
  branding: "/admin/settings?tab=branding",
  school_week_currency: "/admin/settings?tab=school-year",
  academic_year: "/academic-years",
  stages: "/stages",
  grades: "/grades",
  classrooms: "/classrooms",
  subjects: "/subjects",
  teachers: "/teachers",
  students: "/students/new",
};

/** Steps the "standard structure" quick start fills in. */
const STRUCTURE_STEPS = ["academic_year", "stages", "grades", "classrooms", "subjects"];

/**
 * A new school's setup checklist, above the admin dashboard. Hidden once
 * every step is done or the admin dismisses it. See
 * docs/self-service-schools-plan.md, phase 4.
 */
export function OnboardingChecklist() {
  const t = useTranslations("Onboarding");
  const tErrors = useTranslations("Errors");
  const queryClient = useQueryClient();

  const { data: onboarding } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      apiFetch<{ onboarding: OnboardingType }>("/api/admin/onboarding").then(
        (d) => d.onboarding
      ),
  });

  const onError = (error: unknown) =>
    toast.error(
      error instanceof ApiError ? error.message : tErrors("somethingWentWrong")
    );

  const dismiss = useMutation({
    mutationFn: () =>
      apiFetch<{ onboarding: OnboardingType }>("/api/admin/onboarding/dismiss", {
        method: "POST",
      }),
    onSuccess: (data) => queryClient.setQueryData(QUERY_KEY, data.onboarding),
    onError,
  });

  const quickStart = useMutation({
    mutationFn: () =>
      apiFetch<{ onboarding: OnboardingType }>(
        "/api/admin/onboarding/standard-structure",
        { method: "POST" }
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEY, data.onboarding);
      // The dashboard's counts and every structure list (stages, grades,
      // classrooms, subjects, years — each under its own key) just changed.
      queryClient.invalidateQueries();
      toast.success(t("quickStartDone"));
    },
    onError,
  });

  if (!onboarding || onboarding.dismissed) return null;

  const { steps } = onboarding;
  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) return null;

  // Only offered to a school with no structure at all: the server refuses
  // to merge into one the admin started by hand.
  const canQuickStart = steps.some(
    (step) => step.key === "stages" && step.count === 0
  );
  // The first step not done yet is the one to do next.
  const nextKey = steps.find((step) => !step.done)?.key;

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{t("heading")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("progress", { done: doneCount, total: steps.length })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("dismiss")}
          title={t("dismiss")}
          disabled={dismiss.isPending}
          onClick={() => dismiss.mutate()}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      {canQuickStart && (
        <div className="flex flex-col gap-3 rounded-md bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">{t("quickStartBody")}</p>
          <Button
            size="sm"
            className="shrink-0"
            disabled={quickStart.isPending}
            onClick={() => quickStart.mutate()}
          >
            <Sparkles className="size-4" />
            {quickStart.isPending ? t("quickStartRunning") : t("quickStart")}
          </Button>
        </div>
      )}

      <ol className="flex flex-col divide-y">
        {steps.map((step) => (
          <li key={step.key} className="flex items-center gap-3 py-2.5">
            {step.done ? (
              <CheckCircle2 className="size-5 shrink-0 text-primary" />
            ) : (
              <Circle className="size-5 shrink-0 text-muted-foreground" />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span
                className={
                  step.done ? "text-sm text-muted-foreground" : "text-sm font-medium"
                }
              >
                {t(`steps.${step.key}.title`)}
              </span>
              {!step.done && (
                <span className="text-xs text-muted-foreground">
                  {t(`steps.${step.key}.body`)}
                  {canQuickStart && STRUCTURE_STEPS.includes(step.key) &&
                    ` ${t("coveredByQuickStart")}`}
                </span>
              )}
            </div>
            {step.done && step.count !== null ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {step.count}
              </span>
            ) : !step.done ? (
              <Button
                nativeButton={false}
                size="sm"
                variant={step.key === nextKey ? "default" : "outline"}
                render={<Link href={STEP_HREFS[step.key]} />}
              >
                {t("go")}
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
