"use client";

import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useFadeIn } from "@/hooks/use-fade-in";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { Button } from "@/components/ui/button";
import { Brand, LandingNavbar, SECTIONS } from "@/features/home/landing-navbar";
import { Hero } from "@/features/home/hero";
import { CountUp } from "@/features/home/count-up";
import { FeatureBento } from "@/features/home/feature-bento";
import { RolePortals } from "@/features/home/role-portals";
import { Pricing } from "@/features/home/pricing";
import { Faq } from "@/features/home/faq";
import { SectionHeading } from "@/features/home/section-heading";

// Facts about the product, not usage figures: 4 role portals; 8 modules
// (attendance, exams, fees, library, meetings, calendar, students and
// promotions, academic structure); English and Arabic; full RTL.
const STATS = [
  { value: 4, labelKey: "statPortals" },
  { value: 8, labelKey: "statModules" },
  { value: 2, labelKey: "statLanguages" },
  { value: 100, suffix: "%", labelKey: "statRtl" },
] as const;

function Stats() {
  const t = useTranslations("HomePage");

  return (
    <section aria-label={t("statsLabel")} className="mx-auto w-full max-w-6xl px-6">
      <dl className="grid grid-cols-2 divide-border rounded-2xl border bg-card/60 shadow-sm backdrop-blur md:grid-cols-4 md:divide-x">
        {STATS.map((stat) => (
          <div key={stat.labelKey} className="flex flex-col-reverse items-center gap-1 px-4 py-6 text-center">
            <dt className="text-sm text-muted-foreground">{t(stat.labelKey)}</dt>
            <dd className="text-3xl font-bold tracking-tight text-primary md:text-4xl">
              <CountUp value={stat.value} suffix={"suffix" in stat ? stat.suffix : ""} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function HowItWorks() {
  const t = useTranslations("HomePage");
  const ref = useStaggerIn<HTMLOListElement>({ selector: "[data-animate='step']", scroll: true });

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-20 lg:py-28">
      <SectionHeading eyebrow={t("howEyebrow")} heading={t("howHeading")} center />

      <ol ref={ref} className="relative grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-6">
        {/* The line joining the three numbers. */}
        <span aria-hidden className="absolute inset-x-[16%] top-6 hidden h-px bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0 md:block" />
        {[1, 2, 3].map((n) => (
          <li key={n} data-animate="step" className="relative flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-full border-4 border-background bg-primary text-lg font-bold text-primary-foreground shadow-lg shadow-primary/20">
              {n}
            </span>
            <h3 className="mt-1 text-lg font-semibold">{t(`step${n}Title`)}</h3>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{t(`step${n}Body`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FinalCta() {
  const t = useTranslations("HomePage");
  const { user } = useAuth();
  const ref = useFadeIn<HTMLDivElement>({ y: 24, scroll: true });

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-28">
      <div
        ref={ref}
        className="relative isolate overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12"
      >
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute -top-24 -end-24 size-80 rounded-full bg-brand-accent/30 blur-3xl" />
          <div className="absolute -bottom-32 -start-16 size-80 rounded-full bg-white/10 blur-3xl" />
        </div>
        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-balance md:text-4xl">{t("finalCtaHeading")}</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">{t("finalCtaSubtext")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            size="lg"
            className="bg-background px-5 text-foreground hover:bg-background/90"
            nativeButton={false}
            render={<Link href={user ? "/dashboard" : "/create-school"} />}
          >
            {user ? t("ctaDashboard") : t("ctaPrimary")}
            <ArrowRight className="size-4 rtl:rotate-180" />
          </Button>
          {!user && (
            <Button
              size="lg"
              variant="ghost"
              className="px-5 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
              nativeButton={false}
              render={<Link href="/login" />}
            >
              {t("ctaSecondary")}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const t = useTranslations("HomePage");
  const tNav = useTranslations("Nav");
  const linkClass = "text-sm text-muted-foreground transition-colors hover:text-foreground";

  return (
    <footer className="border-t print:hidden">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <Brand />
          <p className="max-w-xs text-sm text-muted-foreground">{t("footerTagline")}</p>
        </div>
        <nav aria-label={t("footerProduct")} className="flex flex-col gap-2.5">
          <span className="text-sm font-semibold">{t("footerProduct")}</span>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={linkClass}>
              {t(s.key)}
            </a>
          ))}
        </nav>
        <nav aria-label={t("footerGetStarted")} className="flex flex-col gap-2.5">
          <span className="text-sm font-semibold">{t("footerGetStarted")}</span>
          <Link href="/create-school" className={linkClass}>
            {t("navCreateSchool")}
          </Link>
          <Link href="/login" className={linkClass}>
            {t("navLogin")}
          </Link>
          <Link href="/register" className={linkClass}>
            {t("footerRegister")}
          </Link>
        </nav>
      </div>
      <div className="border-t">
        <p className="mx-auto w-full max-w-6xl px-6 py-5 text-xs text-muted-foreground">
          {t("footerCopyright", { year: new Date().getFullYear(), brand: tNav("brand") })}
        </p>
      </div>
    </footer>
  );
}

export function HomePage() {
  return (
    <div className="flex flex-1 flex-col pt-3">
      <LandingNavbar />
      <main className="flex flex-1 flex-col">
        <Hero />
        <Stats />
        <FeatureBento />
        <RolePortals />
        <HowItWorks />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
