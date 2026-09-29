"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { Pagination, type PageMeta } from "@/components/pagination";
import { PageLoader } from "@/components/page-loader";
import { AuditTable } from "@/features/platform/audit-table";
import { formatDateTime } from "@/features/platform/format";
import type { AuditLogEntry } from "@/features/platform/types";

interface Session {
  id: number;
  user: { id: number; name: string; email: string } | null;
  reason: string | null;
  started_at: string;
  ended_at: string | null;
  open: boolean;
}

/**
 * For a school's admins: when system admins opened this school, why, and
 * every request they made inside it (docs/central-dashboard-plan.md,
 * phase 5). Transparency: nothing a system admin does here is hidden.
 */
export function SystemAdminActivityPage() {
  const t = useTranslations("SystemAdminActivityPage");
  const locale = useLocale();
  const router = useRouter();
  const { user, isLoading: isAuthLoading, hasRole } = useAuth();
  const [page, setPage] = useState(1);
  const isAdmin = hasRole("admin");

  useEffect(() => {
    if (!isAuthLoading && (!user || !isAdmin)) router.replace("/dashboard");
  }, [isAuthLoading, user, isAdmin, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["system-admin-activity", page],
    queryFn: () =>
      apiFetch<{ audit_logs: AuditLogEntry[]; sessions: Session[]; meta: PageMeta }>(
        `/api/admin/system-admin-activity?page=${page}`
      ),
    enabled: !isAuthLoading && isAdmin,
  });

  if (isAuthLoading || !isAdmin) return <PageLoader />;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("sessionsHeading")}</h2>
        {data && data.sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noSessions")}</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {(data?.sessions ?? []).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  <strong>{s.user?.name ?? t("unknown")}</strong>
                  {s.reason && <span className="text-muted-foreground"> · {s.reason}</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(s.started_at, locale)} →{" "}
                  {s.open ? t("stillOpen") : s.ended_at ? formatDateTime(s.ended_at, locale) : t("expired")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("actionsHeading")}</h2>
        <AuditTable entries={data?.audit_logs ?? []} showSchool={false} isLoading={isLoading} />
        {data && <Pagination meta={data.meta} onPageChange={setPage} />}
      </section>
    </main>
  );
}
