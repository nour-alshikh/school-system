"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageLoader } from "@/components/page-loader";
import { TableSkeletonRows } from "@/components/table-skeleton";
import type { FeeCharge, FeeChargeStatus, ParentFeesSummary } from "./types";
import {
  useParentChildren,
  useSelectedChild,
  withStudent,
} from "@/features/parent-children/use-parent-children";
import { ChildPicker } from "@/features/parent-children/child-picker";

const statusBadgeClass: Record<FeeChargeStatus, string> = {
  unpaid: "bg-muted text-muted-foreground",
  partial: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  waived: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

export function ParentFeesPage() {
  const t = useTranslations("ParentFeesPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/parent-fees");
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!isAuthLoading && user && !hasRole("parent")) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, hasRole, router]);

  const isParent = !isAuthLoading && !!user && hasRole("parent");
  const { data: children } = useParentChildren(isParent);
  const { selectedId, select } = useSelectedChild(children);

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["parent-fees", selectedId],
    queryFn: () =>
      apiFetch<{ summary: ParentFeesSummary; fee_charges: FeeCharge[] }>(
        withStudent("/api/parent/fees", selectedId!)
      ),
    enabled: isParent && selectedId !== undefined,
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const statusLabels: Record<FeeChargeStatus, string> = {
    unpaid: t("statusUnpaid"),
    partial: t("statusPartial"),
    paid: t("statusPaid"),
    waived: t("statusWaived"),
  };

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [data?.fee_charges.length, isLoading],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>

        <ChildPicker
          childList={children ?? []}
          selectedId={selectedId}
          onSelect={select}
        />

        {!isLoading && data?.fee_charges.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noFees")}</p>
        ) : (
          <>
            <div ref={rowsRef}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("feeColumn")}</TableHead>
                    <TableHead>{t("dueColumn")}</TableHead>
                    <TableHead>{t("paidColumn")}</TableHead>
                    <TableHead>{t("statusColumn")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableSkeletonRows columns={4} />
                  ) : (
                    data?.fee_charges.map((charge) => (
                      <TableRow key={charge.id}>
                        <TableCell>
                          {locale === "ar" ? charge.fee_name_ar : charge.fee_name_en}
                        </TableCell>
                        <TableCell>{Number(charge.amount_due).toFixed(2)}</TableCell>
                        <TableCell>{Number(charge.amount_paid).toFixed(2)}</TableCell>
                        <TableCell>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[charge.status]}`}
                          >
                            {statusLabels[charge.status]}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {data && (
              <div className="flex flex-wrap gap-4 text-sm">
                <p>
                  {t("totalDueLabel")}:{" "}
                  <span className="font-medium">{Number(data.summary.total_due).toFixed(2)}</span>
                </p>
                <p>
                  {t("totalPaidLabel")}:{" "}
                  <span className="font-medium">{Number(data.summary.total_paid).toFixed(2)}</span>
                </p>
                <p>
                  {t("totalOutstandingLabel")}:{" "}
                  <span className="font-medium">
                    {Number(data.summary.total_outstanding).toFixed(2)}
                  </span>
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
