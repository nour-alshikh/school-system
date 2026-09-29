"use client";

import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { toast } from "sonner";
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
  const tRoles = useTranslations("LoginChooserPage");
  const tErrors = useTranslations("Errors");
  const { user, isLoading, logout, switchSchool } = useAuth();
  const router = useRouter();
  const ref = useFadeIn<HTMLElement>({ y: -12 });

  async function handleLogout() {
    await logout();
    router.push("/login");
    router.refresh();
  }

  async function handleSwitch(membershipId: number) {
    try {
      await switchSchool(membershipId);
      // The dashboard and navigation depend on the school and role.
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error(tErrors("somethingWentWrong"));
    }
  }

  const otherMemberships =
    user?.memberships.filter((m) => m.id !== user.current_membership?.id) ??
    [];

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

              <DropdownMenuContent align="end" className="w-64">
                {/* A plain div, not DropdownMenuLabel — that renders
                    Base UI's Menu.GroupLabel, which throws unless wrapped
                    in a <Menu.Group> (there's nothing to group here, just
                    a static info block above the actions). */}
                <div className="flex items-center gap-3 px-2 py-3">
                  <div className="size-10 shrink-0">
                    <UserAvatar
                      name={user.name}
                      avatarUrl={user.avatar_url}
                      alt=""
                      className="text-sm"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">
                      {user.name}
                    </span>
                    <span
                      className="truncate text-xs text-muted-foreground"
                      dir="ltr"
                    >
                      {user.email}
                    </span>
                    {user.current_membership && (
                      <span className="truncate text-xs text-muted-foreground">
                        {tRoles(user.current_membership.role)} ·{" "}
                        {user.current_membership.school_name}
                      </span>
                    )}
                  </div>
                </div>
                {otherMemberships.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      {t("switchSchool")}
                    </div>
                    {otherMemberships.map((m) => (
                      <DropdownMenuItem
                        key={m.id}
                        onClick={() => handleSwitch(m.id)}
                      >
                        {tRoles(m.role)} · {m.school_name}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/create-school")}>
                  {t("createSchool")}
                </DropdownMenuItem>
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
