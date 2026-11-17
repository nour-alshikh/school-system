"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useFadeIn } from "@/hooks/use-fade-in";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export const SECTIONS = [
  { id: "features", key: "navFeatures" },
  { id: "portals", key: "navPortals" },
  { id: "pricing", key: "navPricing" },
  { id: "faq", key: "navFaq" },
] as const;

export function Brand() {
  const tNav = useTranslations("Nav");
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg font-semibold">
      <BrandMark />
      <span className="text-[15px]">{tNav("brand")}</span>
    </Link>
  );
}

/** The other language, written in that language ("العربية" / "English"). */
function LanguageLink({ className }: { className?: string }) {
  const tNav = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === "en" ? "ar" : "en";

  return (
    <Link
      href={pathname}
      locale={other}
      lang={other}
      className={cn("rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground", className)}
    >
      {other === "ar" ? tNav("switchToArabic") : tNav("switchToEnglish")}
    </Link>
  );
}

/** The landing page's sticky glass navbar. Below md the links fold into a menu. */
export function LandingNavbar() {
  const tNav = useTranslations("Nav");
  const t = useTranslations("HomePage");
  const { user, isLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useFadeIn<HTMLElement>({ y: -12 });

  const actions = isLoading ? null : user ? (
    <Button size="sm" nativeButton={false} render={<Link href="/dashboard" />}>
      {t("navDashboard")}
    </Button>
  ) : (
    <>
      <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/login" />}>
        {t("navLogin")}
      </Button>
      <Button size="sm" nativeButton={false} render={<Link href="/create-school" />}>
        {t("navCreateSchool")}
      </Button>
    </>
  );

  return (
    <header ref={ref} className="sticky top-3 z-40 px-4 print:hidden">
      <div className="mx-auto max-w-6xl rounded-2xl border bg-background/70 shadow-sm shadow-primary/5 backdrop-blur-xl supports-backdrop-filter:bg-background/60">
        <div className="flex h-14 items-center gap-4 px-3 sm:px-4">
          <Brand />

          <nav aria-label={tNav("mainNavigation")} className="ms-4 hidden items-center gap-1 md:flex">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(s.key)}
              </a>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-1">
            <LanguageLink className="hidden sm:inline-flex" />
            <ThemeToggle />
            <div className="hidden items-center gap-1 md:flex">{actions}</div>
            {user && <UserMenu />}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={open ? t("closeMenu") : t("openMenu")}
              aria-expanded={open}
              aria-controls="landing-menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        {open && (
          <div id="landing-menu" className="flex flex-col gap-1 border-t px-3 pt-2 pb-3 md:hidden">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm hover:bg-muted"
              >
                {t(s.key)}
              </a>
            ))}
            <LanguageLink className="px-3 py-2 sm:hidden" />
            <div className={cn("mt-2 grid gap-2 *:w-full", user ? "grid-cols-1" : "grid-cols-2")}>{actions}</div>
          </div>
        )}
      </div>
    </header>
  );
}
