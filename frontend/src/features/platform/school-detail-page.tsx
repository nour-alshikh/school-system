"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageLoader } from "@/components/page-loader";
import { AuditTable } from "./audit-table";
import { CollectionsChart } from "./collections-chart";
import { formatBytes, timeAgo } from "./format";
import { ManageSchoolPanel } from "./manage-school-panel";
import { MembersPanel } from "./members-panel";
import { OpenSchoolDialog } from "./open-school-dialog";
import { usePlatformPage } from "./use-platform-page";
import { WarningBadges } from "./warning-badges";
import type { PlatformSchoolDetail } from "./types";

const ROLES = ["admin", "teacher", "parent", "student"] as const;
const FEE_STATUSES = ["paid", "partial", "unpaid", "waived"] as const;

/** One school, monitored (docs/central-dashboard-plan.md, phase 4). */
export function SchoolDetailPage({ id }: { id: string }) {
  const t = useTranslations("Platform.detail");
  const tRoles = useTranslations("LoginChooserPage");
  const tSource = useTranslations("Platform.source");
  const locale = useLocale();
  const { ready } = usePlatformPage();

  const { data, isLoading, error } = useQuery({
    queryKey: ["platform", "school", id],
    queryFn: () => apiFetch<PlatformSchoolDetail>(`/api/platform/schools/${id}`),
    enabled: ready,
  });

  if (!ready || isLoading) return <PageLoader />;
  if (error || !data) {
    return <main className="p-6 text-sm text-muted-foreground">{t("notFound")}</main>;
  }

  const { school, finance, activity } = data;
  const money = (amount: string | number) => formatMoney(amount, finance.currency, locale);
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  const totalCharges = FEE_STATUSES.reduce((sum, s) => sum + (finance.status_counts[s] ?? 0), 0);
  const weekday = (day: number) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2026, 0, 4 + day));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Link href="/platform" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{school.name}</h1>
          <WarningBadges warnings={school.warnings} />
          <div className="ms-auto">
            <OpenSchoolDialog schoolId={school.id} schoolName={school.name} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          <span dir="ltr">{school.slug}</span> · {tSource(school.source)} ·{" "}
          {t("createdAt", { when: timeAgo(school.created_at, locale) ?? "" })}
          {school.created_by && ` · ${t("createdBy", { name: school.created_by.name })}`}
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">{t("tabOverview")}</TabsTrigger>
          <TabsTrigger value="people">{t("tabPeople")}</TabsTrigger>
          <TabsTrigger value="finance">{t("tabFinance")}</TabsTrigger>
          <TabsTrigger value="activity">{t("tabActivity")}</TabsTrigger>
          <TabsTrigger value="usage">{t("tabUsage")}</TabsTrigger>
          <TabsTrigger value="audit">{t("tabAudit")}</TabsTrigger>
          <TabsTrigger value="manage">{t("tabManage")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Figure label={t("students")} value={number(school.students)} />
            <Figure label={t("teachers")} value={number(school.teachers)} />
            <Figure label={t("activeUsers")} value={number(school.active_users_7d)} />
            <Figure label={t("outstanding")} value={money(school.outstanding)} />
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border p-4 text-sm sm:grid-cols-2">
            <Row term={t("currency")} value={school.currency ?? t("notChosen")} />
            <Row
              term={t("schoolDays")}
              value={school.school_days ? school.school_days.map(weekday).join(" · ") : t("notChosen")}
            />
            <Row term={t("lastActivity")} value={timeAgo(school.last_activity_at, locale) ?? t("never")} />
            <Row term={t("lastAttendance")} value={school.last_attendance_on ?? t("never")} />
          </dl>
        </TabsContent>

        <TabsContent value="people" className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {ROLES.map((role) => (
              <Figure key={role} label={tRoles(role)} value={number(data.people[role] ?? 0)} />
            ))}
          </div>
          <MembersPanel schoolId={school.id} />
        </TabsContent>

        <TabsContent value="finance" className="mt-4 flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Figure label={t("charged", { year: finance.year ?? "—" })} value={money(finance.charged)} />
            <Figure label={t("collected")} value={money(finance.collected)} />
            <Figure label={t("outstanding")} value={money(finance.outstanding)} />
          </div>
          <CollectionsChart months={finance.collections_by_month} currency={finance.currency} />
          {/* Four states: a labelled list, not a coloured chart. */}
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{t("chargesByStatus")}</h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FEE_STATUSES.map((status) => {
                const count = finance.status_counts[status] ?? 0;
                return (
                  <li key={status} className="flex flex-col rounded-lg border p-3">
                    <span className="text-xs text-muted-foreground">{t(`fee_${status}`)}</span>
                    <span className="text-lg font-semibold tabular-nums">{number(count)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {totalCharges ? new Intl.NumberFormat(locale, { style: "percent" }).format(count / totalCharges) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="activity" className="mt-4 flex flex-col gap-4">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead className="text-end">{t("active7d")}</TableHead>
                  <TableHead className="text-end">{t("active30d")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROLES.map((role) => (
                  <TableRow key={role}>
                    <TableCell>{tRoles(role)}</TableCell>
                    <TableCell className="text-end tabular-nums">{activity.active_7d_by_role[role] ?? 0}</TableCell>
                    <TableCell className="text-end tabular-nums">{activity.active_30d_by_role[role] ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Figure
            label={t("attendanceRate")}
            value={activity.attendance_rate_30d === null ? "—" : new Intl.NumberFormat(locale, { style: "percent" }).format(activity.attendance_rate_30d)}
            sub={t("attendanceRateHint")}
          />
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{t("recentHeading")}</h2>
            {activity.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {activity.recent.map((r) => (
                  <li key={`${r.email}-${r.role}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>
                      {r.name} <span className="text-muted-foreground">· {tRoles(r.role)}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{timeAgo(r.last_seen_at, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        <TabsContent value="usage" className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Figure label={t("storage")} value={formatBytes(school.storage_bytes, locale)} />
            <Figure label={t("students")} value={number(school.students)} />
          </div>
          <ul className="divide-y rounded-lg border text-sm">
            {data.usage.storage_by_collection.length === 0 && (
              <li className="px-3 py-2 text-muted-foreground">{t("noFiles")}</li>
            )}
            {data.usage.storage_by_collection.map((c) => (
              <li key={c.collection} className="flex justify-between px-3 py-2">
                <span>{t(`collection_${c.collection}`)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {t("files", { count: c.files })} · {formatBytes(c.bytes, locale)}
                </span>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditTable entries={data.audit} showSchool={false} />
        </TabsContent>

        <TabsContent value="manage" className="mt-4">
          <ManageSchoolPanel key={school.id + school.status + school.name} school={school} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <section className="flex flex-col gap-1 rounded-lg border p-4">
      <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </section>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}
