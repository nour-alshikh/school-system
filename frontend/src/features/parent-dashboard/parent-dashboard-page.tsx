"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckSquare, ChevronRight, Library, Trophy, UserRound, Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMoney } from "@/hooks/use-money";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/features/calendar/calendar";
import { EmptyState, Panel } from "@/features/admin-dashboard/charts";
import { useParentChildren } from "@/features/parent-children/use-parent-children";
import { timeAgo } from "@/features/platform/format";
import {
  AgendaPanel,
  attendanceRateOf,
  DashboardHeader,
  formatNumber,
  formatPercent,
  RateRing,
  useGreeting,
} from "@/features/role-dashboard/shared";
import type { ParentChildType } from "@/types/generated";

const STORAGE_KEY = "parent-dashboard-child";

function readStoredChild(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? Number(value) : null;
  } catch {
    return null;
  }
}

/** One button per child (at any of the parent's schools); hidden with one child. */
function ChildSwitcher({
  items,
  selectedId,
  onSelect,
}: {
  items: ParentChildType[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  const t = useTranslations("RoleDashboards");
  const locale = useLocale();
  if (items.length < 2) return null;

  return (
    <div role="group" aria-label={t("chooseChild")} className="flex flex-wrap gap-2">
      {items.map((child) => {
        const selected = child.student.id === selectedId;
        const name = locale === "ar" ? child.student.name_ar : child.student.name_en;
        return (
          <button
            key={child.student.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(child.student.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-full border py-1.5 ps-1.5 pe-4 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected ? "border-primary bg-primary/10 font-medium text-primary dark:text-teal-300" : "bg-card hover:bg-muted"
            )}
          >
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {name.charAt(0)}
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span>{name}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {locale === "ar" ? child.student.grade.name_ar : child.student.grade.name_en}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ChildDashboard({ child }: { child: ParentChildType }) {
  const t = useTranslations("RoleDashboards");
  const locale = useLocale();
  const { user } = useAuth();
  // Each child's own school's currency.
  const money = useMoney(child.currency);
  const hasFeature = (feature: string) => !user?.plan_features || user.plan_features.includes(feature);
  const query = `?student=${child.student.id}`;
  const { student, attendance, fees } = child;
  const rate = attendanceRateOf(attendance);
  const outstanding = Number(fees.total_outstanding);
  const name = (en: string, ar: string) => (locale === "ar" ? ar : en);

  const links = [
    { href: `/parent${query}`, icon: UserRound, label: t("childProfile") },
    { href: `/parent-attendance${query}`, icon: CheckSquare, label: t("attendanceHistory") },
    ...(hasFeature("fees") ? [{ href: `/parent-fees${query}`, icon: Wallet, label: t("feesAndPayments") }] : []),
    ...(hasFeature("library") ? [{ href: `/parent-library${query}`, icon: Library, label: t("library") }] : []),
  ];

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <Panel className="lg:col-span-4" title={t("kpiAttendance")} description={t("thisYear")}>
        <div className="flex flex-1 flex-wrap items-center justify-center gap-6">
          <RateRing rate={rate} label={t("present")} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {(
              [
                ["present", attendance.present, "bg-chart-1"],
                ["late", attendance.late, "bg-chart-2"],
                ["absent", attendance.absent, "bg-chart-4"],
                ["excused", attendance.excused, "bg-chart-3"],
              ] as const
            ).map(([key, value, dot]) => (
              <div key={key} className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", dot)} />
                <dt className="text-muted-foreground">{t(key)}</dt>
                <dd className="ms-auto font-medium tabular-nums">{formatNumber(value, locale)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Panel>

      {hasFeature("fees") && (
        <div
          className={cn(
            "flex flex-col justify-between gap-6 rounded-xl p-6 lg:col-span-4",
            outstanding > 0 ? "bg-primary text-primary-foreground" : "border bg-card"
          )}
        >
          <div className="flex flex-col gap-1">
            <span className={cn("text-sm font-medium", outstanding > 0 ? "text-primary-foreground/80" : "text-muted-foreground")}>
              {outstanding > 0 ? t("feesDue") : t("fees")}
            </span>
            <span className="text-3xl font-semibold tracking-tight tabular-nums">{money(fees.total_outstanding)}</span>
            <span className={cn("text-sm", outstanding > 0 ? "text-primary-foreground/80" : "text-muted-foreground")}>
              {outstanding > 0 ? t("paidOfTotal", { paid: money(fees.total_paid), total: money(fees.total_due) }) : t("allPaid")}
            </span>
          </div>
          <Button
            variant={outstanding > 0 ? "secondary" : "outline"}
            className={cn(outstanding > 0 && "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90")}
            nativeButton={false}
            render={<Link href={`/parent-fees${query}`} />}
          >
            {t("viewFees")}
          </Button>
        </div>
      )}

      {hasFeature("exams") && (
        <Panel className="lg:col-span-4" title={t("latestResults")}>
          {child.latest_scores.length === 0 ? (
            <EmptyState>{t("noScores")}</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y">
              {child.latest_scores.map((s) => (
                <li key={s.exam_id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-teal-300">
                    <Trophy className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{name(s.subject_name_en, s.subject_name_ar)}</span>
                    <span className="truncate text-xs text-muted-foreground">{timeAgo(s.submitted_at, locale)}</span>
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      s.percent >= 75 ? "text-emerald-700 dark:text-emerald-400" : s.percent < 50 ? "text-red-700 dark:text-red-400" : ""
                    )}
                  >
                    {formatPercent(s.percent, locale, 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <AgendaPanel className="lg:col-span-7" items={child.agenda} hrefFor={() => undefined} />

      <Panel
        className="lg:col-span-5"
        title={name(student.name_en, student.name_ar)}
        description={`${child.school_name} · ${name(student.grade.name_en, student.grade.name_ar)} · ${student.classroom.name}`}
      >
        <ul className="flex flex-col gap-2">
          {links.map(({ href, icon: Icon, label }) => (
            <li key={href}>
              <Link href={href} className="flex items-center gap-3 rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-muted/50">
                <Icon className="size-4 text-muted-foreground" />
                <span className="flex-1">{label}</span>
                <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </section>
  );
}

export function ParentDashboardPage() {
  const t = useTranslations("RoleDashboards");
  const { user } = useAuth();
  const greeting = useGreeting(user?.name ?? "");
  const { data: children, error } = useParentChildren();
  const [chosenId, setChosenId] = useState<number | null>(readStoredChild);

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  function choose(id: number) {
    setChosenId(id);
    try {
      localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      // ignore
    }
  }

  // The remembered child if they're still one of this parent's, else the first.
  const selected = children?.find((c) => c.student.id === chosenId) ?? children?.[0];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
      <DashboardHeader
        title={greeting}
        actions={
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/parent" />}>
            <UserRound className="size-4" />
            {t("myInfo")}
          </Button>
        }
      />

      {!children ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : !selected ? (
        <EmptyState>{t("noChildren")}</EmptyState>
      ) : (
        <>
          <ChildSwitcher items={children} selectedId={selected.student.id} onSelect={choose} />
          <ChildDashboard key={selected.student.id} child={selected} />
        </>
      )}

      <div id="calendar" className="scroll-mt-20">
        <Calendar />
      </div>
    </main>
  );
}
