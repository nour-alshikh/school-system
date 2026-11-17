"use client";

import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { ArrowRight, Check, GraduationCap, Presentation, ShieldCheck, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useFadeIn } from "@/hooks/use-fade-in";
import { Button } from "@/components/ui/button";
import { BrowserFrame, Screenshot, type ScreenshotName } from "@/features/home/screenshot";
import { SectionHeading } from "@/features/home/section-heading";

const ROLES: { role: ScreenshotName; icon: ComponentType<{ className?: string }>; prefix: string }[] = [
  { role: "admin", icon: ShieldCheck, prefix: "portalAdmin" },
  { role: "teacher", icon: Presentation, prefix: "portalTeacher" },
  { role: "parent", icon: Users, prefix: "portalParent" },
  { role: "student", icon: GraduationCap, prefix: "portalStudent" },
];

export function RolePortals() {
  const t = useTranslations("HomePage");
  const tRoles = useTranslations("LoginChooserPage");
  const ref = useFadeIn<HTMLDivElement>({ y: 24, scroll: true });

  return (
    <section id="portals" className="border-y bg-muted/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-20 lg:py-28">
        <SectionHeading eyebrow={t("portalsEyebrow")} heading={t("portalsHeading")} subtext={t("portalsSubtext")} center />

        <div ref={ref}>
          <TabsPrimitive.Root defaultValue="admin" className="flex flex-col items-center gap-10">
            <TabsPrimitive.List className="relative flex max-w-full gap-1 overflow-x-auto rounded-full border bg-background p-1 shadow-sm">
              {ROLES.map(({ role, icon: Icon }) => (
                <TabsPrimitive.Tab
                  key={role}
                  value={role}
                  className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-active:bg-primary data-active:text-primary-foreground"
                >
                  <Icon className="size-4" />
                  {tRoles(role)}
                </TabsPrimitive.Tab>
              ))}
            </TabsPrimitive.List>

            {ROLES.map(({ role, prefix }) => (
              <TabsPrimitive.Panel
                key={role}
                value={role}
                className="grid w-full gap-10 outline-none lg:grid-cols-12 lg:items-center"
              >
                <div className="flex flex-col items-start gap-5 lg:col-span-4">
                  <h3 className="text-2xl font-bold tracking-tight text-balance">{t(`${prefix}Title`)}</h3>
                  <p className="leading-relaxed text-muted-foreground">{t(`${prefix}Body`)}</p>
                  <ul className="flex flex-col gap-2.5">
                    {[1, 2, 3].map((n) => (
                      <li key={n} className="flex items-start gap-2.5 text-sm">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Check className="size-3" />
                        </span>
                        {t(`${prefix}Point${n}`)}
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" nativeButton={false} render={<Link href={`/login/${role}`} />}>
                    {t("portalCta")}
                    <ArrowRight className="size-4 rtl:rotate-180" />
                  </Button>
                </div>
                <div className="lg:col-span-8">
                  <BrowserFrame>
                    <Screenshot name={role} alt={t("portalScreenshotAlt", { role: tRoles(role) })} sizes="(min-width: 1024px) 66vw, 100vw" />
                  </BrowserFrame>
                </div>
              </TabsPrimitive.Panel>
            ))}
          </TabsPrimitive.Root>
        </div>
      </div>
    </section>
  );
}
