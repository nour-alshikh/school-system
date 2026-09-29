"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination, type PageMeta } from "@/components/pagination";
import { PageLoader } from "@/components/page-loader";
import { AuditTable } from "./audit-table";
import { usePlatformPage } from "./use-platform-page";
import type { AuditLogEntry, PlatformOverview } from "./types";

/**
 * Everything system admins did, across schools (docs/central-dashboard-plan.md,
 * phase 2). Filters in one row above the table.
 */
export function AuditLogPage() {
  const t = useTranslations("Platform.audit");
  const { ready } = usePlatformPage();
  const [schoolId, setSchoolId] = useState("all");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const debouncedAction = useDebouncedValue(action, 300);

  // The school filter's options: the overview is usually cached already.
  const { data: overview } = useQuery({
    queryKey: ["platform", "overview"],
    queryFn: () => apiFetch<PlatformOverview>("/api/platform/overview"),
    enabled: ready,
  });

  const params = new URLSearchParams({ page: String(page) });
  if (schoolId !== "all") params.set("school_id", schoolId);
  if (debouncedAction) params.set("action", debouncedAction);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const { data, isLoading } = useQuery({
    queryKey: ["platform", "audit", params.toString()],
    queryFn: () => apiFetch<{ audit_logs: AuditLogEntry[]; meta: PageMeta }>(`/api/platform/audit-logs?${params}`),
    enabled: ready,
  });

  if (!ready) return <PageLoader />;

  const schools = overview?.schools ?? [];
  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("subheading")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={[{ value: "all", label: t("allSchools") }, ...schools.map((s) => ({ value: String(s.id), label: s.name }))]}
          value={schoolId}
          onValueChange={(v) => resetPage(setSchoolId)(v ?? "all")}
        >
          <SelectTrigger className="h-9 w-52" aria-label={t("school")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allSchools")}</SelectItem>
            {schools.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={action}
          onChange={(e) => resetPage(setAction)(e.target.value)}
          placeholder={t("actionPlaceholder")}
          className="h-9 w-48"
          dir="ltr"
          aria-label={t("action")}
        />
        <Input type="date" value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} className="h-9 w-40" aria-label={t("from")} />
        <Input type="date" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} className="h-9 w-40" aria-label={t("to")} />
      </div>

      <AuditTable entries={data?.audit_logs ?? []} isLoading={isLoading} />
      {data && <Pagination meta={data.meta} onPageChange={setPage} />}
    </main>
  );
}
