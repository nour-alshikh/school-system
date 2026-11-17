"use client";

import type { ComponentType, ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BookOpen, CalendarDays, CheckSquare, ClipboardList, Layers, Receipt } from "lucide-react";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/features/admin-dashboard/utils";
import { SectionHeading } from "@/features/home/section-heading";

/** The small illustrated area at the top of a tile. Decorative. */
function Preview({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden className={cn("rounded-xl border bg-muted/40 p-4 text-xs select-none", className)}>
      {children}
    </div>
  );
}

const STATUS_STYLES = {
  present: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-teal-300",
  late: "bg-brand-accent/15 text-amber-700 dark:text-amber-300",
  absent: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
} as const;

function AttendancePreview() {
  const t = useTranslations("HomePage");
  const rows = [
    { name: t("previewStudent1"), status: "present" },
    { name: t("previewStudent2"), status: "present" },
    { name: t("previewStudent3"), status: "late" },
    { name: t("previewStudent4"), status: "absent" },
  ] as const;
  const label = { present: t("previewPresent"), late: t("previewLate"), absent: t("previewAbsent") };

  return (
    <Preview>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold">{t("previewClassroom")}</span>
        <span className="flex gap-1">
          {(["present", "late", "absent"] as const).map((s) => (
            <span key={s} className={cn("rounded-full px-2 py-0.5 font-medium", STATUS_STYLES[s])}>
              {label[s]}
            </span>
          ))}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <li key={row.name} className="flex items-center gap-2.5 rounded-lg bg-background px-2.5 py-2 shadow-xs">
            <span className="flex size-6 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground">
              {row.name.charAt(0)}
            </span>
            <span className="flex-1 truncate">{row.name}</span>
            <span className={cn("rounded-full px-2 py-0.5 font-medium", STATUS_STYLES[row.status])}>{label[row.status]}</span>
            <span className="hidden text-muted-foreground tabular-nums sm:inline">{["08:01", "08:03", "08:24", "—"][i]}</span>
          </li>
        ))}
      </ul>
    </Preview>
  );
}

function ExamsPreview() {
  const t = useTranslations("HomePage");
  const locale = useLocale();
  const bars = [18, 30, 46, 70, 92, 78, 52, 28];

  return (
    <Preview className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold">{t("previewScores")}</span>
        <span className="text-muted-foreground">{t("previewAverage", { value: formatNumber(76, locale) })}</span>
      </div>
      <div className="flex h-24 flex-1 items-end gap-1.5" dir="ltr">
        {bars.map((h, i) => (
          <span
            key={i}
            style={{ height: `${h}%` }}
            className={cn("flex-1 rounded-t-md", i === 4 ? "bg-primary" : "bg-primary/30")}
          />
        ))}
      </div>
    </Preview>
  );
}

function InvoicePreview() {
  const t = useTranslations("HomePage");
  const locale = useLocale();
  const lines = [
    { label: t("previewTuition"), amount: 4500 },
    { label: t("previewBus"), amount: 900 },
    { label: t("previewBooks"), amount: 350 },
  ];

  return (
    <Preview>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold">{t("previewInvoice")} #1042</span>
        <span className={cn("rounded-full px-2 py-0.5 font-medium", STATUS_STYLES.present)}>{t("previewPaid")}</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {lines.map((line) => (
          <li key={line.label} className="flex justify-between gap-2 text-muted-foreground">
            <span className="truncate">{line.label}</span>
            <span className="tabular-nums">{formatNumber(line.amount, locale)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-between border-t pt-2 font-semibold">
        <span>{t("previewTotal")}</span>
        <span className="tabular-nums">{formatNumber(5750, locale)}</span>
      </div>
    </Preview>
  );
}

function LibraryPreview() {
  const t = useTranslations("HomePage");
  const books = [
    { title: t("previewBook1"), spine: "bg-primary" },
    { title: t("previewBook2"), spine: "bg-sky-500" },
    { title: t("previewBook3"), spine: "bg-brand-accent" },
  ];

  return (
    <Preview>
      <ul className="flex flex-col gap-2">
        {books.map((book) => (
          <li key={book.title} className="flex items-center gap-2.5 rounded-lg bg-background px-2.5 py-2 shadow-xs">
            <span className={cn("h-7 w-1.5 shrink-0 rounded-full", book.spine)} />
            <span className="flex-1 truncate font-medium">{book.title}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-muted-foreground">✓ {t("previewBookAvailable")}</p>
    </Preview>
  );
}

function CalendarPreview() {
  const t = useTranslations("HomePage");
  const locale = useLocale();
  // A generic month that starts on the fourth weekday, with two events.
  const offset = 3;
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const events: Record<number, string> = { 12: "bg-brand-accent", 13: "bg-brand-accent", 22: "bg-sky-500" };

  return (
    <Preview className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="grid flex-1 grid-cols-7 gap-1 text-center" dir="ltr">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((d) => (
          <span
            key={d}
            className={cn(
              "relative rounded-md py-1 tabular-nums",
              d === 17 ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"
            )}
          >
            {formatNumber(d, locale)}
            {events[d] && <span className={cn("absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full", events[d])} />}
          </span>
        ))}
      </div>
      <ul className="flex flex-col gap-1.5 sm:w-44">
        <li className="flex items-center gap-2 rounded-lg bg-background px-2.5 py-2 shadow-xs">
          <span className="size-2 rounded-full bg-brand-accent" />
          <span className="truncate">{t("previewEventExams")}</span>
        </li>
        <li className="flex items-center gap-2 rounded-lg bg-background px-2.5 py-2 shadow-xs">
          <span className="size-2 rounded-full bg-sky-500" />
          <span className="truncate">{t("previewEventTrip")}</span>
        </li>
      </ul>
    </Preview>
  );
}

function StructurePreview() {
  const t = useTranslations("HomePage");
  const tree = [
    { stage: t("previewPrimary"), grades: [{ name: t("previewGrade1"), classes: ["1-A", "1-B"] }, { name: t("previewGrade2"), classes: ["2-A"] }] },
    { stage: t("previewPreparatory"), grades: [{ name: t("previewGrade7"), classes: ["7-A", "7-B", "7-C"] }] },
  ];

  return (
    <Preview className="grid gap-3 sm:grid-cols-2">
      {tree.map((node) => (
        <div key={node.stage} className="rounded-lg bg-background p-3 shadow-xs">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <span className="size-2 rounded-full bg-primary" />
            {node.stage}
          </div>
          <ul className="ms-1 flex flex-col gap-2 border-s ps-3">
            {node.grades.map((grade) => (
              <li key={grade.name} className="flex flex-wrap items-center gap-1.5">
                <span className="me-1 text-muted-foreground">{grade.name}</span>
                {grade.classes.map((c) => (
                  <span key={c} dir="ltr" className="rounded border bg-muted/60 px-1.5 py-0.5 font-medium tabular-nums">
                    {c}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Preview>
  );
}

const TILES: {
  icon: ComponentType<{ className?: string }>;
  titleKey: string;
  bodyKey: string;
  preview: ComponentType;
  span: string;
}[] = [
  { icon: CheckSquare, titleKey: "attendanceTitle", bodyKey: "attendanceBody", preview: AttendancePreview, span: "lg:col-span-2" },
  { icon: ClipboardList, titleKey: "examsTitle", bodyKey: "examsBody", preview: ExamsPreview, span: "" },
  { icon: Receipt, titleKey: "feesTitle", bodyKey: "feesBody", preview: InvoicePreview, span: "" },
  { icon: CalendarDays, titleKey: "calendarTitle", bodyKey: "calendarBody", preview: CalendarPreview, span: "lg:col-span-2" },
  { icon: Layers, titleKey: "structureTitle", bodyKey: "structureBody", preview: StructurePreview, span: "lg:col-span-2" },
  { icon: BookOpen, titleKey: "libraryTitle", bodyKey: "libraryBody", preview: LibraryPreview, span: "lg:col-span-1" },
];

export function FeatureBento() {
  const t = useTranslations("HomePage");
  const ref = useStaggerIn<HTMLDivElement>({ selector: "[data-animate='tile']", scroll: true });

  return (
    <section id="features" className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-20 lg:py-28">
      <SectionHeading eyebrow={t("featuresEyebrow")} heading={t("featuresHeading")} subtext={t("featuresSubtext")} />

      <div ref={ref} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TILES.map(({ icon: Icon, titleKey, bodyKey, preview: TilePreview, span }) => (
          <article
            key={titleKey}
            data-animate="tile"
            className={cn(
              "group flex flex-col gap-5 rounded-2xl border bg-card p-5 transition-[border-color,box-shadow] hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
              span && `md:col-span-2 ${span}`
            )}
          >
            <div className="flex-1">
              <TilePreview />
            </div>
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4.5" />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{t(titleKey)}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{t(bodyKey)}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
