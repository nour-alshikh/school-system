"use client";

import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CalendarRange,
  CheckSquare,
  ClipboardList,
  DollarSign,
  GraduationCap,
  Languages,
  Layers,
  Library,
  Presentation,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useFadeIn } from "@/hooks/use-fade-in";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { loginRoles, type LoginRole } from "@/lib/schemas";
import { Button } from "@/components/ui/button";

const capabilities: { icon: ComponentType<{ className?: string }>; key: string }[] = [
  { icon: Users, key: "capOneSystem" },
  { icon: Languages, key: "capBilingual" },
  { icon: ShieldCheck, key: "capAccess" },
  { icon: CalendarRange, key: "capSchoolYear" },
];

const features: {
  icon: ComponentType<{ className?: string }>;
  titleKey: string;
  bodyKey: string;
  featured?: boolean;
}[] = [
  { icon: CheckSquare, titleKey: "attendanceTitle", bodyKey: "attendanceBody", featured: true },
  { icon: ClipboardList, titleKey: "examsTitle", bodyKey: "examsBody", featured: true },
  { icon: DollarSign, titleKey: "feesTitle", bodyKey: "feesBody" },
  { icon: Library, titleKey: "libraryTitle", bodyKey: "libraryBody" },
  { icon: Layers, titleKey: "structureTitle", bodyKey: "structureBody" },
];

const roleIcons: Record<LoginRole, ComponentType<{ className?: string }>> = {
  admin: ShieldCheck,
  teacher: Presentation,
  student: GraduationCap,
  parent: Users,
};

const roleDescKeys: Record<LoginRole, string> = {
  admin: "roleAdminDesc",
  teacher: "roleTeacherDesc",
  student: "roleStudentDesc",
  parent: "roleParentDesc",
};

const steps: { titleKey: string; bodyKey: string }[] = [
  { titleKey: "step1Title", bodyKey: "step1Body" },
  { titleKey: "step2Title", bodyKey: "step2Body" },
  { titleKey: "step3Title", bodyKey: "step3Body" },
];

function Hero() {
  const t = useTranslations("HomePage");
  const tNav = useTranslations("Nav");
  const { user, isLoading } = useAuth();
  const ref = useFadeIn<HTMLElement>({ y: 20 });

  const primaryHref = user ? "/dashboard" : "/register";

  return (
    <section ref={ref} className="mx-auto grid w-full max-w-5xl gap-12 px-6 pt-16 pb-20 md:grid-cols-12 md:items-center md:pt-20">
      <div className="flex flex-col gap-6 md:col-span-7">
        <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          {t("heroHeadline")}
        </h1>
        <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
          {t("heroSubtext")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" render={<Link href={primaryHref} />}>
            {t("ctaPrimary")}
            <ArrowRight className="size-4" />
          </Button>
          {!isLoading && !user && (
            <Button size="lg" variant="outline" render={<Link href="/login" />}>
              {t("ctaSecondary")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:col-span-5">
        {(
          [
            { icon: CheckSquare, label: tNav("attendance") },
            { icon: ClipboardList, label: tNav("exams") },
            { icon: DollarSign, label: tNav("fees") },
            { icon: Library, label: tNav("library") },
          ] as const
        ).map(({ icon: Icon, label }, i) => (
          <div
            key={label}
            className={
              "flex flex-col gap-3 rounded-lg border p-5 " +
              (i % 3 === 0 ? "bg-primary/10" : "bg-muted/30")
            }
          >
            <Icon className="size-5 text-primary" />
            <span className="text-sm font-medium">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CapabilityStrip() {
  const t = useTranslations("HomePage");
  const ref = useStaggerIn<HTMLDivElement>({ selector: "[data-animate='cap']" });

  return (
    <section className="border-t">
      <div
        ref={ref}
        className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-6 px-6 py-10 sm:grid-cols-4"
      >
        {capabilities.map(({ icon: Icon, key }) => (
          <div key={key} data-animate="cap" className="flex items-center gap-2.5">
            <Icon className="size-4 shrink-0 text-primary" />
            <span className="text-sm text-muted-foreground">{t(key)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const t = useTranslations("HomePage");
  const ref = useStaggerIn<HTMLDivElement>({ selector: "[data-animate='feature']" });

  return (
    <section className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-16">
        <div className="flex max-w-xl flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t("featuresHeading")}
          </h2>
          <p className="text-muted-foreground">{t("featuresSubtext")}</p>
        </div>

        <div ref={ref} className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          {features.map(({ icon: Icon, titleKey, bodyKey, featured }) => (
            <div
              key={titleKey}
              data-animate="feature"
              className={
                "flex flex-col gap-3 rounded-lg border p-5 " +
                (featured ? "sm:col-span-3 bg-primary/[0.06]" : "sm:col-span-2")
              }
            >
              <Icon className="size-5 text-primary" />
              <h3 className="font-semibold">{t(titleKey)}</h3>
              <p className="text-sm text-muted-foreground">{t(bodyKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RolePortals() {
  const t = useTranslations("HomePage");
  const tRoles = useTranslations("LoginChooserPage");
  const ref = useStaggerIn<HTMLDivElement>({ selector: "[data-animate='role']" });

  return (
    <section className="border-t bg-muted/20">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-16">
        <div className="flex max-w-xl flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t("rolesHeading")}
          </h2>
          <p className="text-muted-foreground">{t("rolesSubtext")}</p>
        </div>

        <div ref={ref} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loginRoles.map((role) => {
            const Icon = roleIcons[role];
            return (
              <Link
                key={role}
                href={`/login/${role}`}
                data-animate="role"
                className="group flex flex-col gap-3 rounded-lg border bg-background p-5 transition-colors hover:border-primary/40"
              >
                <Icon className="size-5 text-primary" />
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold">{tRoles(role)}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t(roleDescKeys[role])}
                  </p>
                </div>
                <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {t("roleCta")}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const t = useTranslations("HomePage");
  const ref = useStaggerIn<HTMLDivElement>({ selector: "[data-animate='step']" });

  return (
    <section className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {t("howHeading")}
        </h2>

        <div ref={ref} className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {steps.map(({ titleKey, bodyKey }, i) => (
            <div key={titleKey} data-animate="step" className="flex flex-col gap-2">
              <span className="text-sm font-mono text-primary/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-semibold">{t(titleKey)}</h3>
              <p className="text-sm text-muted-foreground">{t(bodyKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const t = useTranslations("HomePage");
  const { user } = useAuth();
  const ref = useFadeIn<HTMLElement>();

  if (user) return null;

  return (
    <section ref={ref} className="border-t bg-primary/[0.06]">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-5 px-6 py-16 sm:items-center sm:text-center">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {t("finalCtaHeading")}
        </h2>
        <p className="max-w-md text-muted-foreground">{t("finalCtaSubtext")}</p>
        <Button size="lg" render={<Link href="/register" />}>
          {t("ctaPrimary")}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  const t = useTranslations("HomePage");
  const tNav = useTranslations("Nav");
  const { user } = useAuth();

  return (
    <footer className="border-t print:hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{tNav("brand")}</span>
          <span className="text-sm text-muted-foreground">{t("footerTagline")}</span>
        </div>

        <div className="flex items-center gap-6 text-sm">
          {!user && (
            <>
              <Link href="/login" className="text-muted-foreground hover:text-foreground">
                {tNav("login")}
              </Link>
              <Link href="/register" className="text-muted-foreground hover:text-foreground">
                {tNav("register")}
              </Link>
            </>
          )}
          <span className="text-muted-foreground">
            {t("footerCopyright", { year: new Date().getFullYear(), brand: tNav("brand") })}
          </span>
        </div>
      </div>
    </footer>
  );
}

export function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      <CapabilityStrip />
      <Features />
      <RolePortals />
      <HowItWorks />
      <FinalCta />
      <Footer />
    </div>
  );
}
