"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Archive, Ban, CalendarX, Gauge, UserX } from "lucide-react";
import type { ComponentType } from "react";
import type { SchoolWarning } from "./types";

// Status colours are reserved for state, and always come with an icon and
// a label, never colour alone.
const WARNINGS: Record<SchoolWarning, { icon: ComponentType<{ className?: string }>; className: string }> = {
  suspended: { icon: Ban, className: "bg-red-500/10 text-red-700 dark:text-red-300" },
  archived: { icon: Archive, className: "bg-muted text-muted-foreground" },
  no_admin: { icon: UserX, className: "bg-red-500/10 text-red-700 dark:text-red-300" },
  inactive: { icon: AlertTriangle, className: "bg-amber-500/10 text-amber-800 dark:text-amber-300" },
  attendance_gap: { icon: CalendarX, className: "bg-amber-500/10 text-amber-800 dark:text-amber-300" },
  near_limit: { icon: Gauge, className: "bg-amber-500/10 text-amber-800 dark:text-amber-300" },
};

export function WarningBadges({ warnings }: { warnings: SchoolWarning[] }) {
  const t = useTranslations("Platform.warnings");

  if (warnings.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {warnings.map((warning) => {
        const { icon: Icon, className } = WARNINGS[warning];
        return (
          <span
            key={warning}
            title={t(`${warning}Hint`)}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
          >
            <Icon className="size-3" />
            {t(warning)}
          </span>
        );
      })}
    </div>
  );
}
