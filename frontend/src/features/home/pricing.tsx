"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Check, Minus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import type { PublicPlanType } from "@/types/generated";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, intlLocale } from "@/features/admin-dashboard/utils";
import { SectionHeading } from "@/features/home/section-heading";

// The modules a plan can include (Plan::FEATURES on the backend).
const FEATURES = [
  { key: "exams", labelKey: "featureExams" },
  { key: "fees", labelKey: "featureFees" },
  { key: "library", labelKey: "featureLibrary" },
  { key: "meetings", labelKey: "featureMeetings" },
  { key: "ai", labelKey: "featureAi" },
] as const;

const PLAN_NAMES: Record<string, string> = { basic: "planBasic", standard: "planStandard", unlimited: "planUnlimited" };

function formatStorage(mb: number, locale: string): string {
  const [value, unit] = mb >= 1024 ? [mb / 1024, "gigabyte"] : [mb, "megabyte"];
  return new Intl.NumberFormat(intlLocale(locale), { style: "unit", unit, unitDisplay: "short", maximumFractionDigits: 1 }).format(value);
}

/**
 * The plans from GET /api/plans: limits and modules, no prices (billing
 * doesn't exist yet). New schools start on the self-service plan; the
 * others go through the platform's contact email, hidden when unset.
 */
export function Pricing() {
  const t = useTranslations("HomePage");
  const locale = useLocale();
  const { data, isPending, isError } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => apiFetch<{ plans: PublicPlanType[]; contact_email: string | null }>("/api/plans"),
    staleTime: 10 * 60 * 1000,
  });
  const ref = useStaggerIn<HTMLDivElement>({ selector: "[data-animate='plan']", scroll: true, deps: [data] });

  const planName = (plan: PublicPlanType) => (PLAN_NAMES[plan.key] ? t(PLAN_NAMES[plan.key]) : plan.name);
  const starter = data?.plans.find((p) => p.self_service);

  return (
    <section id="pricing" className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-20 lg:py-28">
      <SectionHeading
        eyebrow={t("pricingEyebrow")}
        heading={t("pricingHeading")}
        subtext={starter ? t("pricingSubtext", { plan: planName(starter) }) : undefined}
        center
      />

      {isError && <p className="text-center text-sm text-muted-foreground">{t("pricingError")}</p>}

      <div ref={ref} className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {isPending &&
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-96 rounded-2xl" />)}

        {data?.plans.map((plan) => {
          const highlighted = plan.self_service;
          return (
            <article
              key={plan.key}
              data-animate="plan"
              className={cn(
                "relative flex flex-col gap-6 rounded-2xl border bg-card p-6",
                highlighted && "border-primary shadow-xl shadow-primary/10 ring-1 ring-primary"
              )}
            >
              {highlighted && (
                <span className="absolute -top-3 start-6 rounded-full bg-brand-accent px-3 py-0.5 text-xs font-semibold text-brand-accent-foreground">
                  {t("pricingStartHere")}
                </span>
              )}
              <div className="flex flex-col gap-1.5">
                <h3 className="text-lg font-semibold">{planName(plan)}</h3>
                <p className="text-2xl font-bold tracking-tight">
                  {plan.max_students === null
                    ? t("pricingUnlimitedStudents")
                    : t("pricingStudents", { count: formatNumber(plan.max_students, locale) })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {plan.max_storage_mb === null
                    ? t("pricingUnlimitedStorage")
                    : t("pricingStorage", { size: formatStorage(plan.max_storage_mb, locale) })}
                </p>
              </div>

              <ul className="flex flex-1 flex-col gap-2.5 border-t pt-5 text-sm">
                <li className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {t("pricingCore")}
                </li>
                {FEATURES.map((feature) => {
                  const included = plan.features.includes(feature.key);
                  return (
                    <li key={feature.key} className={cn("flex items-start gap-2.5", !included && "text-muted-foreground")}>
                      {included ? (
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      ) : (
                        <Minus className="mt-0.5 size-4 shrink-0" />
                      )}
                      <span>
                        {t(feature.labelKey)}
                        <span className="sr-only"> ({included ? t("pricingIncluded") : t("pricingNotIncluded")})</span>
                      </span>
                    </li>
                  );
                })}
              </ul>

              {plan.self_service ? (
                <Button nativeButton={false} render={<Link href="/create-school" />}>
                  {t("pricingCreate")}
                </Button>
              ) : (
                data.contact_email && (
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<a href={`mailto:${data.contact_email}?subject=${encodeURIComponent(planName(plan))}`} />}
                  >
                    {t("pricingContact")}
                  </Button>
                )
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
