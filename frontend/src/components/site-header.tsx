"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function LocaleSwitcher() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const otherLocale = locale === "en" ? "ar" : "en";

  return (
    <Link href={pathname} locale={otherLocale} className="text-sm underline">
      {otherLocale === "ar" ? t("switchToArabic") : t("switchToEnglish")}
    </Link>
  );
}

export function SiteHeader() {
  const t = useTranslations("Nav");
  const { user, isLoading, can, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-sm font-semibold">
          {t("brand")}
        </Link>

        <div className="flex items-center gap-4">
          {isLoading ? null : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 text-sm">
                <span className="h-7 w-7">
                  <UserAvatar
                    name={user.name}
                    avatarUrl={user.avatar_url}
                    alt=""
                    className="text-xs"
                  />
                </span>
                {user.name}
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                  {t("dashboard")}
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => router.push("/stages")}>
                  {t("stages")}
                </DropdownMenuItem>

                {can("manage-users") && (
                  <DropdownMenuItem
                    onClick={() => router.push("/admin/users")}
                  >
                    {t("manageUsers")}
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={handleLogout}>
                  {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-4 text-sm">
              <Link href="/login" className="underline">
                {t("login")}
              </Link>
              <Link href="/register" className="underline">
                {t("register")}
              </Link>
            </div>
          )}

          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
