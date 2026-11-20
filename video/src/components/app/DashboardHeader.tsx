import type { ReactNode } from "react";
import { useLocale } from "next-intl";
import { intlLocale } from "@/features/admin-dashboard/utils";
import { today } from "../../mock";

/**
 * role-dashboard/shared.tsx DashboardHeader, same markup, but with the
 * video's fixed "today" instead of new Date() so every render shows the
 * same date.
 */
export function DashboardHeader({ title, badges, actions }: { title: string; badges?: ReactNode; actions?: ReactNode }) {
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "full" }).format(new Date(`${today}T09:00:00`))}
          {badges}
        </p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
