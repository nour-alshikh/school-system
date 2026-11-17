"use client";

import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, CircleCheck, ClipboardCheck, Languages, Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useFadeIn } from "@/hooks/use-fade-in";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrowserFrame, Screenshot } from "@/features/home/screenshot";

/** A small floating card over the hero screenshot. Decorative: the screenshot carries the meaning. */
function MiniCard({
  icon: Icon,
  iconClassName,
  title,
  note,
  className,
  delay,
}: {
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  title: string;
  note: string;
  className: string;
  delay: string;
}) {
  return (
    <div
      aria-hidden
      style={{ animationDelay: delay }}
      className={cn(
        "absolute z-10 hidden items-center gap-3 rounded-xl border bg-card/95 px-3.5 py-2.5 shadow-xl shadow-primary/10 backdrop-blur sm:flex dark:shadow-black/40",
        "motion-safe:animate-[landing-float_6s_ease-in-out_infinite]",
        className
      )}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", iconClassName)}>
        <Icon className="size-4.5" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{note}</span>
      </span>
    </div>
  );
}

export function Hero() {
  const t = useTranslations("HomePage");
  const { user, isLoading } = useAuth();
  const textRef = useFadeIn<HTMLDivElement>({ y: 20 });
  const visualRef = useFadeIn<HTMLDivElement>({ y: 32, delay: 0.15, duration: 0.7 });

  return (
    <section className="relative isolate overflow-hidden">
      {/* Soft teal glow and a faint grid behind the hero. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute -top-40 start-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl rtl:translate-x-1/2 dark:bg-primary/20" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-40 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-14 px-6 pt-16 pb-20 lg:grid-cols-12 lg:items-center lg:gap-8 lg:pt-24 lg:pb-28">
        <div ref={textRef} className="flex flex-col items-start gap-6 lg:col-span-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent/15 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-brand-accent/40 dark:text-amber-300">
            <Languages className="size-3.5" />
            {t("heroBadge")}
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem] lg:leading-[1.08]">
            {t("heroHeadline")}
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">{t("heroSubtext")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" className="px-5" nativeButton={false} render={<Link href={user ? "/dashboard" : "/create-school"} />}>
              {user ? t("ctaDashboard") : t("ctaPrimary")}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
            {!isLoading && !user && (
              <Button size="lg" variant="outline" className="px-5" nativeButton={false} render={<Link href="/login" />}>
                {t("ctaSecondary")}
              </Button>
            )}
          </div>
        </div>

        <div ref={visualRef} className="relative lg:col-span-7">
          <div className="lg:[perspective:2200px]">
            <BrowserFrame className="lg:origin-left lg:[transform:rotateY(-14deg)_rotateX(6deg)] rtl:lg:origin-right rtl:lg:[transform:rotateY(14deg)_rotateX(6deg)]">
              <Screenshot name="admin" alt={t("heroScreenshotAlt")} priority sizes="(min-width: 1024px) 60vw, 100vw" />
            </BrowserFrame>
          </div>

          <MiniCard
            icon={CircleCheck}
            iconClassName="bg-primary/10 text-primary"
            title={`94% · ${t("heroCardAttendance")}`}
            note={t("heroCardAttendanceNote")}
            className="-bottom-6 start-2 lg:-start-8"
            delay="0s"
          />
          <MiniCard
            icon={Wallet}
            iconClassName="bg-brand-accent/15 text-amber-700 dark:text-amber-300"
            title={t("heroCardPayment")}
            note={t("heroCardPaymentNote")}
            className="-top-6 end-2 lg:-end-4"
            delay="-2s"
          />
          <MiniCard
            icon={ClipboardCheck}
            iconClassName="bg-sky-500/10 text-sky-700 dark:text-sky-300"
            title={t("heroCardExam")}
            note={t("heroCardExamNote")}
            className="end-6 bottom-10 sm:hidden xl:flex"
            delay="-4s"
          />
        </div>
      </div>
    </section>
  );
}
