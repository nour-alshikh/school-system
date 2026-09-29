"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Info, OctagonAlert, X } from "lucide-react";
import type { ComponentType } from "react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";

interface Announcement {
  id: number;
  title: string;
  body: string | null;
  level: "info" | "warning" | "critical";
  dismissible: boolean;
}

const QUERY_KEY = ["announcements"];

// State colours, always with an icon and the text itself.
const LEVELS: Record<Announcement["level"], { icon: ComponentType<{ className?: string }>; className: string }> = {
  info: { icon: Info, className: "border-sky-500/30 bg-sky-50 text-sky-950 dark:bg-sky-950 dark:text-sky-100" },
  warning: { icon: AlertTriangle, className: "border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100" },
  critical: { icon: OctagonAlert, className: "border-red-500/40 bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-100" },
};

/**
 * Announcements from the system admin for this school and role
 * (docs/central-dashboard-plan.md, phase 8), above every page. Critical
 * ones can't be dismissed.
 */
export function AnnouncementsBanner() {
  const t = useTranslations("Announcements");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inSchool = !!user && (!!user.current_membership || !!user.acting_as);

  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<{ announcements: Announcement[] }>("/api/announcements").then((d) => d.announcements),
    enabled: inSchool,
    staleTime: 5 * 60 * 1000,
  });

  const dismiss = useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/announcements/${id}/dismiss`, { method: "POST" }),
    onMutate: (id) =>
      queryClient.setQueryData<Announcement[]>(QUERY_KEY, (prev) => prev?.filter((a) => a.id !== id)),
  });

  if (!inSchool || !data?.length) return null;

  return (
    <div className="flex flex-col print:hidden">
      {data.map((a) => {
        const { icon: Icon, className } = LEVELS[a.level];
        return (
          <div key={a.id} role={a.level === "critical" ? "alert" : "status"} className={`flex items-start gap-3 border-b px-4 py-2 text-sm ${className}`}>
            <Icon className="mt-0.5 size-4 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{a.title}</span>
              {a.body && <span className="whitespace-pre-line opacity-90">{a.body}</span>}
            </div>
            {a.dismissible && (
              <button
                type="button"
                className="rounded p-0.5 opacity-70 hover:opacity-100"
                aria-label={t("dismiss")}
                title={t("dismiss")}
                onClick={() => dismiss.mutate(a.id)}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
