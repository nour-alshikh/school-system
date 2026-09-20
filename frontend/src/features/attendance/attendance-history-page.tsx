"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { AttendanceRecord, AttendanceStatus } from "./types";
import type { Classroom } from "@/features/classrooms/types";

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return toISODate(new Date());
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

const statusBadgeClass: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  absent: "bg-red-500/10 text-red-600 dark:text-red-400",
  late: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  excused: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

export function AttendanceHistoryPage() {
  const t = useTranslations("AttendanceHistoryPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can, hasRole } = useAuth();
  const router = useRouter();

  const canAccess = can("manage-attendance") || hasRole("teacher");

  const [classroomId, setClassroomId] = useState<string>("");
  const [from, setFrom] = useState<string>(daysAgo(30));
  const [to, setTo] = useState<string>(today());

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/attendance/history");
    }
  }, [isAuthLoading, user, router]);

  const {
    data: classrooms = [],
    isLoading: isLoadingClassrooms,
    error: classroomsError,
  } = useQuery({
    queryKey: ["attendance-classrooms"],
    queryFn: () =>
      apiFetch<{ classrooms: Classroom[] }>("/api/attendance/classrooms").then(
        (d) => d.classrooms
      ),
    enabled: !isAuthLoading && !!user && canAccess,
  });

  useEffect(() => {
    if (!classroomsError) return;
    toast.error(
      classroomsError instanceof ApiError ? classroomsError.message : t("loadError")
    );
  }, [classroomsError, t]);

  // Same single-classroom fallback as the marking page — see
  // attendance-page.tsx for why this is derived rather than set in an
  // effect.
  const effectiveClassroomId =
    classroomId || (classrooms.length === 1 ? String(classrooms[0].id) : "");

  const {
    data: records,
    isLoading: isLoadingRecords,
    error: recordsError,
  } = useQuery({
    queryKey: ["attendance-history", effectiveClassroomId, from, to],
    queryFn: () =>
      apiFetch<{ records: AttendanceRecord[] }>(
        `/api/classrooms/${effectiveClassroomId}/attendance/history?from=${from}&to=${to}`
      ).then((d) => d.records),
    enabled: !!effectiveClassroomId && !!from && !!to,
  });

  useEffect(() => {
    if (!recordsError) return;
    toast.error(
      recordsError instanceof ApiError ? recordsError.message : t("recordsLoadError")
    );
  }, [recordsError, t]);

  const statusLabels: Record<AttendanceStatus, string> = {
    present: t("statusPresent"),
    absent: t("statusAbsent"),
    late: t("statusLate"),
    excused: t("statusExcused"),
  };

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [records?.length, isLoadingRecords],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={classrooms.map((c) => ({ value: String(c.id), label: c.name }))}
            value={effectiveClassroomId}
            onValueChange={(value) => setClassroomId(value ?? "")}
            disabled={isLoadingClassrooms || classrooms.length === 0}
          >
            <SelectTrigger aria-label={t("classroomLabel")} className="w-48">
              <SelectValue placeholder={t("classroomPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {classrooms.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 w-40"
            aria-label={t("fromLabel")}
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 w-40"
            aria-label={t("toLabel")}
          />
        </div>

        {!isLoadingClassrooms && classrooms.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("noClassrooms")}</p>
        )}

        {effectiveClassroomId && (
          <div ref={rowsRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dateColumn")}</TableHead>
                  <TableHead>{t("studentColumn")}</TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                  <TableHead>{t("notesColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingRecords ? (
                  <TableSkeletonRows columns={4} />
                ) : !records || records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">
                      {t("noRecords")}
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-muted-foreground">{record.date}</TableCell>
                      <TableCell>
                        {locale === "ar" ? record.student_name_ar : record.student_name_en}
                      </TableCell>
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
