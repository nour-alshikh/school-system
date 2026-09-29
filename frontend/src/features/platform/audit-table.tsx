"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/table-skeleton";
import { formatDateTime } from "./format";
import type { AuditLogEntry } from "./types";

/** Actions with a translated label; anything else shows its code. */
const KNOWN_ACTIONS = [
  "platform.signed_in",
  "platform.two_factor_reset",
  "school.created",
  "school.updated",
  "school.suspended",
  "school.reactivated",
  "platform.entered_school",
  "platform.exited_school",
  "platform.request",
  "school.admin_added",
  "school.admin_removed",
  "school.member_suspended",
  "school.member_reactivated",
  "school.password_reset_sent",
  "school.archived",
  "school.exported",
  "school.export_downloaded",
  "school.purged",
  "announcement.created",
  "announcement.updated",
  "announcement.ended",
  "plan.updated",
  "school.plan_changed",
  "school.self_registered",
];

/** A request made inside a school: "POST /api/stages → 201 · name". */
function requestSummary(details: Record<string, unknown>): string {
  const fields = Array.isArray(details.fields) ? ` · ${(details.fields as string[]).join(", ")}` : "";
  return `${details.method} ${details.path} → ${details.status}${fields}`;
}

export function AuditTable({
  entries,
  showSchool = true,
  isLoading = false,
}: {
  entries: AuditLogEntry[];
  showSchool?: boolean;
  isLoading?: boolean;
}) {
  const t = useTranslations("Platform.audit");
  const locale = useLocale();
  const columns = showSchool ? 5 : 4;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("when")}</TableHead>
            <TableHead>{t("who")}</TableHead>
            <TableHead>{t("action")}</TableHead>
            {showSchool && <TableHead>{t("school")}</TableHead>}
            <TableHead>{t("details")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableSkeletonRows columns={columns} />
          ) : entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns} className="text-center text-sm text-muted-foreground">
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(entry.created_at, locale)}</TableCell>
                <TableCell>
                  {entry.actor ? (
                    <>
                      {entry.actor.name}
                      <div className="text-xs text-muted-foreground" dir="ltr">{entry.actor.email}</div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">{t("system")}</span>
                  )}
                </TableCell>
                <TableCell>
                  {KNOWN_ACTIONS.includes(entry.action) ? t(`actions.${entry.action.replace(".", "_")}`) : <code className="text-xs">{entry.action}</code>}
                </TableCell>
                {showSchool && <TableCell>{entry.school?.name ?? "—"}</TableCell>}
                <TableCell className="max-w-72 text-xs text-muted-foreground">
                  {entry.details && entry.action === "platform.request" ? (
                    <code className="break-all" dir="ltr">{requestSummary(entry.details)}</code>
                  ) : entry.details ? (
                    <code className="break-all" dir="ltr">{JSON.stringify(entry.details)}</code>
                  ) : (
                    "—"
                  )}
                  {entry.ip && <div dir="ltr">{entry.ip}</div>}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
