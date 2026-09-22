"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
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
import type { AttendanceRecord, AttendanceStatus, ParentAttendanceSummary } from "./types";

const statusBadgeClass: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  absent: "bg-red-500/10 text-red-600 dark:text-red-400",
  late: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  excused: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

export function ParentAttendancePage() {
  const t = useTranslations("ParentAttendancePage");
  const { user, isLoading: isAuthLoading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/parent-attendance");
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!isAuthLoading && user && !hasRole("parent")) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, hasRole, router]);

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["parent-attendance"],
    queryFn: () =>
      apiFetch<{ summary: ParentAttendanceSummary; records: AttendanceRecord[] }>(
        "/api/parent/attendance"
      ),
    enabled: !isAuthLoading && !!user && hasRole("parent"),
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const statusLabels: Record<AttendanceStatus, string> = {
    present: t("statusPresent"),
    absent: t("statusAbsent"),
    late: t("statusLate"),
    excused: t("statusExcused"),
  };

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [data?.records.length, isLoading],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>

        {data && (
          <div className="flex flex-wrap gap-2">
            {(["present", "absent", "late", "excused"] as const).map((status) => (
              <span
                key={status}
                className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass[status]}`}
              >
                {statusLabels[status]}: {data.summary[status]}
              </span>
            ))}
          </div>
        )}

        {!isLoading && data?.records.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noRecords")}</p>
        ) : (
          <div ref={rowsRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dateColumn")}</TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                  <TableHead>{t("notesColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeletonRows columns={3} />
                ) : (
                  data?.records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-muted-foreground">{record.date}</TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[record.status]}`}
                        >
                          {statusLabels[record.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.notes ?? ""}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </main>
  );
}
