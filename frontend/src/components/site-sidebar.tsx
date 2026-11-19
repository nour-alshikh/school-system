"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuth, useSessionHint } from "@/contexts/auth-context";
import { SidebarSkeleton } from "@/components/app-skeletons";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { cn } from "@/lib/utils";
import { Logo, LogoIcon } from "@/components/logo";
import { useNavSections, type NavItem } from "@/components/app-nav";

const STORAGE_KEY = "sidebar-collapsed";

// SiteSidebar never renders real DOM during SSR — it returns null until
// useAuth() resolves (well after hydration) — so reading localStorage in
// these lazy initializers can't cause a hydration mismatch, and avoids the
// setState-in-effect this project's lint rule flags for the usual
// "sync from localStorage in an effect" pattern.
function readStored(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "1";
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // ignore
  }
}

/**
 * The logo and the current school's name, at the top of the sidebar and the
 * drawer. Collapsed, just the mark.
 */
export function SidebarBrand({ collapsed = false }: { collapsed?: boolean }) {
  const t = useTranslations("Nav");
  const { user } = useAuth();
  const schoolName = user?.acting_as?.school_name ?? user?.current_membership?.school_name;

  return (
    <Link
      href="/dashboard"
      aria-label={t("brand")}
      className={cn("flex min-w-0 flex-col gap-1 rounded-lg", collapsed && "items-center")}
      title={collapsed ? t("brand") : undefined}
    >
      {collapsed ? (
        <LogoIcon className="size-8" />
      ) : (
        <>
          <Logo className="h-9" />
          {schoolName && <span className="truncate text-xs text-muted-foreground">{schoolName}</span>}
        </>
      )}
    </Link>
  );
}

const linkBase =
  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";
const linkIdle = "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
// Teal tint plus an amber bar on the inline-start edge (flips for Arabic).
const linkActive =
  "bg-primary/10 font-medium text-primary dark:bg-sidebar-accent dark:text-sidebar-foreground before:absolute before:inset-y-1.5 before:start-0 before:w-[3px] before:rounded-full before:bg-brand-accent";

function SidebarLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      data-animate="sidebar-link"
      onClick={onNavigate}
      className={cn(linkBase, collapsed && "justify-center px-0", active ? linkActive : linkIdle)}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

// An index page with its create/history pages, collapsible. Opens by
// itself when the current page is inside it. Icon-only, it's a single link
// to the index page, since there's no room to nest.
function SidebarGroup({
  item,
  activeHref,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  activeHref: string | null;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const children = item.children ?? [];
  const containsActive = children.some((child) => child.href === activeHref);
  const [open, setOpen] = useState(() => readStored(item.storageKey ?? "", false));
  const Icon = item.icon;

  if (collapsed) {
    return <SidebarLink item={item} active={containsActive} collapsed onNavigate={onNavigate} />;
  }

  const expanded = open || containsActive;

  function toggle() {
    const next = !expanded;
    setOpen(next);
    if (item.storageKey) writeStored(item.storageKey, next);
  }

  return (
    <div className="flex flex-col gap-0.5" data-animate="sidebar-link">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className={cn(linkBase, "w-full", containsActive ? "font-medium text-sidebar-foreground" : linkIdle)}
      >
        <Icon className={cn("size-4 shrink-0", containsActive && "text-primary dark:text-sidebar-primary")} />
        <span className="flex-1 truncate text-start">{item.label}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded && (
        <div className="ms-5 flex flex-col gap-0.5 border-s border-sidebar-border ps-2">
          {children.map((child) => (
            <SidebarLink
              key={child.href}
              item={child}
              active={child.href === activeHref}
              collapsed={false}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** The grouped links. Used by the desktop sidebar and the mobile drawer. */
export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const t = useTranslations("Nav");
  const { sections, activeHref } = useNavSections();

  return (
    <nav aria-label={t("mainNavigation")} className="flex flex-col gap-4">
      {sections.map((section, index) => (
        <div key={section.key} className="flex flex-col gap-0.5">
          {collapsed ? (
            index > 0 && <div className="mx-2 mb-2 h-px bg-sidebar-border" aria-hidden />
          ) : (
            <h2 className="px-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {section.label}
            </h2>
          )}
          {section.items.map((item) =>
            item.children ? (
              <SidebarGroup
                key={item.href}
                item={item}
                activeHref={activeHref}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ) : (
              <SidebarLink
                key={item.href}
                item={item}
                active={item.href === activeHref}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            )
          )}
        </div>
      ))}
    </nav>
  );
}

export function useLogout() {
  const { logout } = useAuth();
  const router = useRouter();

  return async () => {
    await logout();
    router.push("/login");
    router.refresh();
  };
}

export function SiteSidebar() {
  const t = useTranslations("Nav");
  const { user, isLoading } = useAuth();
  const sessionHint = useSessionHint();
  const pathname = usePathname();
  const handleLogout = useLogout();
  const [collapsed, setCollapsed] = useState(() => readStored(STORAGE_KEY, false));
  const ref = useStaggerIn<HTMLElement>({ selector: "[data-animate='sidebar-link']" });

  function toggle() {
    setCollapsed((prev) => {
      writeStored(STORAGE_KEY, !prev);
      return !prev;
    });
  }

  // No sidebar until there's someone logged in to show nav for. The landing
  // page is a full-width marketing page even for logged-in users.
  if (pathname === "/") return null;
  if (isLoading && sessionHint) return <SidebarSkeleton collapsed={collapsed} />;
  if (isLoading || !user) return null;

  const footerButton = cn(linkBase, linkIdle, "w-full", collapsed && "justify-center px-0");

  return (
    <aside
      ref={ref}
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-150 print:hidden md:flex",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("flex h-14 shrink-0 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4")}>
        <SidebarBrand collapsed={collapsed} />
      </div>

      <div className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
        <SidebarNav collapsed={collapsed} />
      </div>

      <div className={cn("flex shrink-0 flex-col gap-0.5 border-t border-sidebar-border py-3", collapsed ? "px-2" : "px-3")}>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
          title={collapsed ? t("expandSidebar") : undefined}
          className={footerButton}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0 rtl:-scale-x-100" />
          ) : (
            <PanelLeftClose className="size-4 shrink-0 rtl:-scale-x-100" />
          )}
          {!collapsed && <span className="truncate">{t("collapseSidebar")}</span>}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          aria-label={collapsed ? t("logout") : undefined}
          title={collapsed ? t("logout") : undefined}
          className={footerButton}
        >
          <LogOut className="size-4 shrink-0 rtl:-scale-x-100" />
          {!collapsed && <span className="truncate">{t("logout")}</span>}
        </button>
      </div>
    </aside>
  );
}
