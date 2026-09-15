"use client";

import { useState, type ComponentType } from "react";
import { useTranslations } from "next-intl";
import {
  CalendarRange,
  DoorOpen,
  GraduationCap,
  LayoutDashboard,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  UserPlus,
  Users,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "sidebar-collapsed";

// SiteSidebar never renders real DOM during SSR — it returns null until
// useAuth() resolves (well after hydration) — so reading localStorage in
// this lazy initializer can't cause a hydration mismatch, and avoids the
// setState-in-effect this project's lint rule flags for the usual
// "sync from localStorage in an effect" pattern.
function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  collapsed,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      data-animate="sidebar-link"
      className={cn(
        "flex items-center gap-2 truncate rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
        collapsed && "justify-center px-2",
        isActive && "bg-muted font-medium"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && label}
    </Link>
  );
}

export function SiteSidebar() {
  const t = useTranslations("Nav");
  const { user, isLoading, can } = useAuth();
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);
  const ref = useStaggerIn<HTMLElement>({ selector: "[data-animate='sidebar-link']" });

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
      ref={ref}
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

      <SidebarLink
        href="/dashboard"
        icon={LayoutDashboard}
        label={t("dashboard")}
        collapsed={collapsed}
      />
      <SidebarLink
        href="/stages"
        icon={GraduationCap}
        label={t("stages")}
        collapsed={collapsed}
      />
      <SidebarLink
        href="/grades"
        icon={Layers}
        label={t("grades")}
        collapsed={collapsed}
      />
      <SidebarLink
        href="/classrooms"
        icon={DoorOpen}
        label={t("classrooms")}
        collapsed={collapsed}
      />
      <SidebarLink
        href="/academic-years"
        icon={CalendarRange}
        label={t("academicYears")}
        collapsed={collapsed}
      />

      {can("manage-students") && (
        <SidebarLink
          href="/students"
          icon={UserPlus}
          label={t("students")}
          collapsed={collapsed}
        />
      )}

      {can("manage-users") && (
        <SidebarLink
          href="/admin/users"
          icon={Users}
          label={t("manageUsers")}
          collapsed={collapsed}
        />
      )}
    </nav>
  );
}
