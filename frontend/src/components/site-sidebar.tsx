"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "sidebar-collapsed";

function SidebarLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "truncate rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
        isActive && "bg-muted font-medium"
      )}
    >
      {children}
    </Link>
  );
}

export function SiteSidebar() {
  const t = useTranslations("Nav");
  const { user, isLoading, can } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // Per-viewer UI preference only, not app state — read/write best-effort so
  // a private window or blocked storage just falls back to always-expanded.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  // Same guest/loading gate as SiteHeader's user menu — no sidebar until
  // there's someone logged in to show nav for.
  if (isLoading || !user) return null;

  return (
    <nav
      className={cn(
        "hidden shrink-0 flex-col gap-1 border-e p-2 transition-[width] duration-150 md:flex",
        collapsed ? "w-12 items-center" : "w-48 p-4"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
        className="mb-2 self-end"
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4" />
        ) : (
          <PanelLeftClose className="size-4" />
        )}
      </Button>

      {!collapsed && (
        <>
          <SidebarLink href="/dashboard">{t("dashboard")}</SidebarLink>
          <SidebarLink href="/stages">{t("stages")}</SidebarLink>

          {can("manage-users") && (
            <SidebarLink href="/admin/users">{t("manageUsers")}</SidebarLink>
          )}
        </>
      )}
    </nav>
  );
}
