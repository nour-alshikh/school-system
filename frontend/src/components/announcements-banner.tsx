"use client";

import { OctagonAlert } from "lucide-react";
import { useAnnouncements } from "@/hooks/use-announcements";

/**
 * Critical announcements from the system admin, above every page. They
 * can't be dismissed, so they stay in sight; info and warning ones live in
 * the top bar's notifications menu instead.
 */
export function AnnouncementsBanner() {
  const { announcements } = useAnnouncements();
  const critical = announcements.filter((a) => a.level === "critical");

  if (!critical.length) return null;

  return (
    <div className="flex flex-col print:hidden">
      {critical.map((a) => (
        <div
          key={a.id}
          role="alert"
          className="flex items-start gap-3 border-b border-red-500/40 bg-red-50 px-4 py-2 text-sm text-red-950 dark:bg-red-950 dark:text-red-100"
        >
          <OctagonAlert className="mt-0.5 size-4 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium">{a.title}</span>
            {a.body && <span className="whitespace-pre-line opacity-90">{a.body}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
