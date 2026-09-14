"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

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
        "rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
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

  // Same guest/loading gate as SiteHeader's user menu — no sidebar until
  // there's someone logged in to show nav for.
  if (isLoading || !user) return null;

  return (
    <nav className="hidden w-48 shrink-0 flex-col gap-1 border-e p-4 md:flex">
      <SidebarLink href="/dashboard">{t("dashboard")}</SidebarLink>
      <SidebarLink href="/stages">{t("stages")}</SidebarLink>

      {can("manage-users") && (
        <SidebarLink href="/admin/users">{t("manageUsers")}</SidebarLink>
      )}
    </nav>
  );
}
