"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Building2, Camera, Languages, LogOut, Menu, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useFadeIn } from "@/hooks/use-fade-in";
import { UserAvatar } from "@/components/user-avatar";
import { AvatarUploader } from "@/components/avatar-uploader";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandMenu } from "@/components/command-menu";
import { AcademicYearMenu } from "@/components/academic-year-menu";
import { NotificationsMenu } from "@/components/notifications-menu";
import { SidebarBrand, SidebarNav, useLogout } from "@/components/site-sidebar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const label = otherLocale === "ar" ? t("switchToArabic") : t("switchToEnglish");

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      nativeButton={false}
      render={<Link href={pathname} locale={otherLocale} />}
    >
      <Languages className="size-4" />
    </Button>
  );
}

/** Below md the sidebar is hidden; this opens the same nav as a drawer from the inline-start edge. */
function MobileNav() {
  const t = useTranslations("Nav");
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={<Button variant="ghost" size="icon" className="md:hidden" aria-label={t("openMenu")} />}
      >
        <Menu className="size-5" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 md:hidden" />
        <DialogPrimitive.Popup className="fixed inset-y-0 start-0 z-50 flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl outline-none transition-transform duration-200 ease-out data-ending-style:-translate-x-full data-starting-style:-translate-x-full md:hidden rtl:data-ending-style:translate-x-full rtl:data-starting-style:translate-x-full">
          <DialogPrimitive.Title className="sr-only">{t("mainNavigation")}</DialogPrimitive.Title>
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
            <SidebarBrand />
            <DialogPrimitive.Close render={<Button variant="ghost" size="icon-sm" aria-label={t("closeMenu")} />}>
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function UserMenu() {
  const t = useTranslations("Nav");
  const tRoles = useTranslations("LoginChooserPage");
  const tAvatar = useTranslations("Avatar");
  const tErrors = useTranslations("Errors");
  const { user, switchSchool } = useAuth();
  const router = useRouter();
  const handleLogout = useLogout();
  const [avatarOpen, setAvatarOpen] = useState(false);

  if (!user) return null;

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

  // Inside a school as system admin: the banner's Exit is the way out.
  // Switching or creating a school would replace that session's token.
  const actingAs = !!user.acting_as;
  const otherMemberships = actingAs
    ? []
    : user.memberships.filter((m) => m.id !== user.current_membership?.id);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="size-8 shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label={user.name}
          title={user.name}
        >
          <UserAvatar name={user.name} avatarUrl={user.avatar_url} alt="" className="text-xs" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          {/* A plain div, not DropdownMenuLabel — that renders Base UI's
              Menu.GroupLabel, which throws unless wrapped in a <Menu.Group>
              (there's nothing to group here, just a static info block). */}
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="size-10 shrink-0">
              <UserAvatar name={user.name} avatarUrl={user.avatar_url} alt="" className="text-sm" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground" dir="ltr">
                {user.email}
              </span>
              {user.current_membership && (
                <span className="truncate text-xs text-muted-foreground">
                  {tRoles(user.current_membership.role)} · {user.current_membership.school_name}
                </span>
              )}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setAvatarOpen(true)}>
            <Camera />
            {tAvatar("changeAvatar")}
          </DropdownMenuItem>
          {otherMemberships.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground">{t("switchSchool")}</div>
              {otherMemberships.map((m) => (
                <DropdownMenuItem key={m.id} onClick={() => handleSwitch(m.id)}>
                  <Building2 />
                  <span className="truncate">
                    {tRoles(m.role)} · {m.school_name}
                  </span>
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          {!actingAs && (
            <DropdownMenuItem onClick={() => router.push("/create-school")}>
              <Plus />
              {t("createSchool")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="rtl:-scale-x-100" />
            {t("logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={avatarOpen} onOpenChange={setAvatarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tAvatar("changeAvatar")}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <AvatarUploader />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SiteHeader() {
  const t = useTranslations("Nav");
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const ref = useFadeIn<HTMLElement>({ y: -12 });

  // Guests, and everyone on the landing page (a full-width marketing page
  // with no sidebar), get the simple bar. Step 3 of the design refresh
  // replaces the landing page's.
  if (isLoading || !user || pathname === "/") {
    return (
      <header ref={ref} className="border-b print:hidden">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-semibold">
            {t("brand")}
          </Link>
          <div className="flex items-center gap-2">
            {!isLoading &&
              (user ? (
                <Button size="sm" nativeButton={false} render={<Link href="/dashboard" />}>
                  {t("dashboard")}
                </Button>
              ) : (
                <div className="flex items-center gap-4 text-sm">
                  <Link href="/login" className="underline">
                    {t("login")}
                  </Link>
                  <Link href="/register" className="underline">
                    {t("register")}
                  </Link>
                </div>
              ))}
            <ThemeToggle />
            <LocaleSwitcher />
            {user && <UserMenu />}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header
      ref={ref}
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-backdrop-filter:bg-background/70 print:hidden sm:px-4 lg:px-6"
    >
      <MobileNav />
      <CommandMenu />
      <div className="ms-auto flex items-center gap-1 sm:gap-2">
        <AcademicYearMenu />
        <NotificationsMenu />
        <ThemeToggle />
        <LocaleSwitcher />
        <UserMenu />
      </div>
    </header>
  );
}
