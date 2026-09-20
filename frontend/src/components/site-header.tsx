"use client";

import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useFadeIn } from "@/hooks/use-fade-in";
import { UserAvatar } from "@/components/user-avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
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
  const label =
    otherLocale === "ar" ? t("switchToArabic") : t("switchToEnglish");

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      render={<Link href={pathname} locale={otherLocale} />}
    >
      <Languages className="size-4" />
    </Button>
  );
}

export function SiteHeader() {
  const t = useTranslations("Nav");
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const ref = useFadeIn<HTMLElement>({ y: -12 });

  async function handleLogout() {
    await logout();
    router.push("/login");
    router.refresh();
  }

  return (
    <header ref={ref} className="border-b print:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-sm font-semibold">
          {t("brand")}
        </Link>

        <div className="flex items-center gap-4">
          {isLoading ? null : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="size-7 rounded-full"
                aria-label={user.name}
                title={user.name}
              >
                <UserAvatar
                  name={user.name}
                  avatarUrl={user.avatar_url}
                  alt=""
                  className="text-xs"
                />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                {/* A plain div, not DropdownMenuLabel — that renders
                    Base UI's Menu.GroupLabel, which throws unless wrapped
                    in a <Menu.Group> (there's nothing to group here, just
                    a static info line above the actions). */}
                <div className="flex flex-col gap-0.5 px-1.5 py-1">
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {user.email}
                  </span>
                </div>
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

          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
