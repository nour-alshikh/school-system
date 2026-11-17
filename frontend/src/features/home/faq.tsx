"use client";

import { useTranslations } from "next-intl";
import { Accordion } from "@base-ui/react/accordion";
import { Plus } from "lucide-react";
import { useFadeIn } from "@/hooks/use-fade-in";
import { SectionHeading } from "@/features/home/section-heading";

const QUESTIONS = [1, 2, 3, 4, 5, 6] as const;

export function Faq() {
  const t = useTranslations("HomePage");
  const ref = useFadeIn<HTMLDivElement>({ y: 24, scroll: true });

  return (
    <section id="faq" className="border-t bg-muted/30">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-20 lg:grid-cols-12 lg:py-28">
        <div className="lg:col-span-4">
          <SectionHeading eyebrow={t("faqEyebrow")} heading={t("faqHeading")} />
        </div>

        <div ref={ref} className="lg:col-span-8">
          <Accordion.Root className="flex flex-col gap-3">
            {QUESTIONS.map((n) => (
              <Accordion.Item key={n} className="rounded-xl border bg-card">
                <Accordion.Header>
                  <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 rounded-xl px-5 py-4 text-start font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    {t(`faqQ${n}`)}
                    <Plus className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-panel-open:rotate-45" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Panel className="h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
                  <p className="px-5 pb-5 leading-relaxed text-muted-foreground">{t(`faqA${n}`)}</p>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </div>
      </div>
    </section>
  );
}
