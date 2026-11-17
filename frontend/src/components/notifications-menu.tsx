"use client";

import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import { Popover } from "@base-ui/react/popover";
import { AlertTriangle, Bell, BellOff, Info, OctagonAlert, X } from "lucide-react";
import { useAnnouncements, type Announcement } from "@/hooks/use-announcements";
import { Button } from "@/components/ui/button";

// State colours, always with an icon and the text itself.
const LEVELS: Record<Announcement["level"], { icon: ComponentType<{ className?: string }>; className: string }> = {
  info: { icon: Info, className: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  warning: { icon: AlertTriangle, className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  critical: { icon: OctagonAlert, className: "bg-red-500/10 text-red-700 dark:text-red-300" },
};

/** The bell in the top bar: the system admin's announcements for this school and role. */
export function NotificationsMenu() {
  const t = useTranslations("Nav");
  const tAnnouncements = useTranslations("Announcements");
  const { inSchool, announcements, dismiss } = useAnnouncements();

  if (!inSchool) return null;

  const count = announcements.length;
  const label = count ? t("notificationsCount", { count }) : t("notifications");

  return (
    <Popover.Root>
      <Popover.Trigger
        render={<Button variant="ghost" size="icon" className="relative" aria-label={label} title={label} />}
      >
        <Bell className="size-4" />
        {count > 0 && (
          <span
            aria-hidden
            className="absolute end-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[10px] leading-4 font-semibold text-brand-accent-foreground"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="end" className="isolate z-50">
          <Popover.Popup className="w-80 max-w-[calc(100vw-2rem)] origin-(--transform-origin) rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Popover.Title className="border-b px-4 py-3 text-sm font-semibold">{t("notifications")}</Popover.Title>
            {count === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
                <BellOff className="size-5" />
                {t("notificationsEmpty")}
              </div>
            ) : (
              <ul className="max-h-96 divide-y overflow-y-auto">
                {announcements.map((a) => {
                  const { icon: Icon, className } = LEVELS[a.level];
                  return (
                    <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                      <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${className}`}>
                        <Icon className="size-3.5" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-sm font-medium">{a.title}</span>
                        {a.body && (
                          <span className="text-xs whitespace-pre-line text-muted-foreground">{a.body}</span>
                        )}
                      </div>
                      {a.dismissible && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={tAnnouncements("dismiss")}
                          title={tAnnouncements("dismiss")}
                          onClick={() => dismiss(a.id)}
                        >
                          <X />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
