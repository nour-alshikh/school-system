"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoader } from "@/components/page-loader";
import { TableSkeletonRows } from "@/components/table-skeleton";
import { formatBytes, timeAgo } from "./format";
import { usePlatformPage } from "./use-platform-page";
import { WarningBadges } from "./warning-badges";
import { AiUsageCard } from "./ai-usage-card";
import type { PlatformOverview, PlatformSchoolRow } from "./types";

const QUERY_KEY = ["platform", "overview"];

type SortKey = "name" | "students" | "teachers" | "active_users_7d" | "last_activity_at" | "storage_bytes" | "warnings";

/**
 * The central dashboard's home (docs/central-dashboard-plan.md, phase 4):
 * platform totals, then every school with its numbers and warnings.
 */
export function PlatformOverviewPage() {
  const t = useTranslations("Platform.overview");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { ready } = usePlatformPage();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<PlatformOverview>("/api/platform/overview"),
    enabled: ready,
  });

  // Skips the server's 10-minute cache.
  async function refresh() {
    setRefreshing(true);
    try {
      queryClient.setQueryData(QUERY_KEY, await apiFetch<PlatformOverview>("/api/platform/overview?refresh=1"));
    } finally {
      setRefreshing(false);
    }
  }

  if (!ready) return <PageLoader />;

  const totals = data?.totals;
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{t("heading")}</h1>
          {data && (
            <p className="text-xs text-muted-foreground">
              {t("updated", { when: timeAgo(data.generated_at, locale) ?? "" })}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing || isLoading}>
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          {t("refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat
          label={t("schools")}
          value={totals ? number((totals.schools.active ?? 0) + (totals.schools.suspended ?? 0)) : null}
          sub={totals?.schools.suspended ? t("suspendedCount", { count: totals.schools.suspended }) : undefined}
        />
        <Stat label={t("students")} value={totals ? number(totals.students) : null} />
        <Stat label={t("teachers")} value={totals ? number(totals.teachers) : null} />
        <Stat label={t("parents")} value={totals ? number(totals.parents) : null} />
        <Stat label={t("activeUsers")} value={totals ? number(totals.active_users_7d) : null} sub={t("last7Days")} />
        <section className="flex flex-col gap-1 rounded-lg border p-4">
          <h2 className="text-xs font-medium text-muted-foreground">{t("collectedThisMonth")}</h2>
          {data ? (
            data.collected_this_month.length === 0 ? (
              <p className="text-2xl font-semibold tabular-nums">—</p>
            ) : (
              data.collected_this_month.map((line) => (
                <p key={line.currency ?? "none"} className="text-lg font-semibold tabular-nums">
                  {formatMoney(line.amount, line.currency, locale)}
                </p>
              ))
            )
          ) : (
            <div className="h-7 w-24 animate-pulse rounded bg-muted" />
          )}
        </section>
      </div>

      <AiUsageCard usage={data?.ai_usage} />

      <SchoolsTable rows={data?.schools} isLoading={isLoading} />
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | null; sub?: string }) {
  return (
    <section className="flex flex-col gap-1 rounded-lg border p-4">
      <h2 className="text-xs font-medium text-muted-foreground">{label}</h2>
      {value === null ? (
        <div className="h-8 w-16 animate-pulse rounded bg-muted" />
      ) : (
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      )}
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </section>
  );
}

function SchoolsTable({ rows, isLoading }: { rows?: PlatformSchoolRow[]; isLoading: boolean }) {
  const t = useTranslations("Platform.overview");
  const tSource = useTranslations("Platform.source");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  // Archived schools are hidden unless asked for.
  const [status, setStatus] = useState<string>("current");
  // Warnings first by default: they're what needs attention.
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "warnings", desc: true });

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (rows ?? []).filter(
      (row) =>
        (status === "all" || (status === "current" ? row.status !== "archived" : row.status === status)) &&
        (!term || row.name.toLowerCase().includes(term) || row.slug.includes(term))
    );
    const value = (row: PlatformSchoolRow): string | number => {
      if (sort.key === "warnings") return row.warnings.length;
      if (sort.key === "last_activity_at") return row.last_activity_at ?? "";
      return row[sort.key];
    };
    return [...filtered].sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), locale);
      return sort.desc ? -order : order;
    });
  }, [rows, search, status, sort, locale]);

  function sortBy(key: SortKey) {
    setSort((current) => ({ key, desc: current.key === key ? !current.desc : key !== "name" }));
  }

  const header = (key: SortKey, label: string, numeric = false) => (
    <TableHead className={numeric ? "text-end" : undefined} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => sortBy(key)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        {sort.key === key && (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </TableHead>
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="me-auto text-base font-semibold">{t("schoolsHeading")}</h2>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-9 w-56"
          aria-label={t("searchPlaceholder")}
        />
        <Select
          items={[
            { value: "current", label: t("currentStatuses") },
            { value: "active", label: t("statusActive") },
            { value: "suspended", label: t("statusSuspended") },
            { value: "archived", label: t("statusArchived") },
            { value: "all", label: t("allStatuses") },
          ]}
          value={status}
          onValueChange={(v) => setStatus(v ?? "all")}
        >
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">{t("currentStatuses")}</SelectItem>
            <SelectItem value="active">{t("statusActive")}</SelectItem>
            <SelectItem value="suspended">{t("statusSuspended")}</SelectItem>
            <SelectItem value="archived">{t("statusArchived")}</SelectItem>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {header("name", t("colSchool"))}
              {header("students", t("colStudents"), true)}
              {header("teachers", t("colTeachers"), true)}
              <TableHead className="text-end">{t("colOutstanding")}</TableHead>
              {header("active_users_7d", t("colActive"), true)}
              {header("last_activity_at", t("colLastActivity"))}
              {header("storage_bytes", t("colStorage"), true)}
              {header("warnings", t("colWarnings"))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeletonRows columns={8} />
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  {t("noSchools")}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link href={`/platform/schools/${row.id}`} className="font-medium hover:underline">
                      {row.name}
                    </Link>
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {row.slug} · {row.plan.name} · {tSource(row.source)}
                    </div>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{row.students}</TableCell>
                  <TableCell className="text-end tabular-nums">{row.teachers}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatMoney(row.outstanding, row.currency, locale)}</TableCell>
                  <TableCell className="text-end tabular-nums">{row.active_users_7d}</TableCell>
                  <TableCell className="text-muted-foreground">{timeAgo(row.last_activity_at, locale) ?? t("never")}</TableCell>
                  <TableCell className="text-end tabular-nums text-muted-foreground">{formatBytes(row.storage_bytes, locale)}</TableCell>
                  <TableCell>
                    <WarningBadges warnings={row.warnings} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
