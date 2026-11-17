"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Info, Plus, Trash2, X } from "lucide-react";
import { SCHOOL_CURRENCIES } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SchoolWeekField } from "@/features/settings/school-week-field";
import { BLUEPRINT_LIMITS } from "./limits";
import type { BlueprintGrade, BlueprintStage, SchoolBlueprint } from "./types";

type Named = { name_en: string; name_ar: string };

/**
 * The blueprint as a tree to review and edit before signup
 * (docs/ai-assistant-plan.md, phase 2): rename stages and grades, add or
 * remove grades and classrooms, remove subjects, and set the year, week and
 * currency. Names are edited in the UI's language; a name that's the same
 * in both languages (something just added) changes in both.
 */
export function BlueprintEditor({
  blueprint,
  onChange,
}: {
  blueprint: SchoolBlueprint;
  onChange: (next: SchoolBlueprint) => void;
}) {
  const t = useTranslations("BlueprintEditor");
  const locale = useLocale();
  const key = locale === "ar" ? "name_ar" : "name_en";
  const other = locale === "ar" ? "name_en" : "name_ar";

  const totals = useMemo(() => {
    const grades = blueprint.stages.flatMap((s) => s.grades);
    return {
      stages: blueprint.stages.length,
      grades: grades.length,
      classrooms: grades.reduce((n, g) => n + g.classrooms.length, 0),
      subjects: blueprint.subjects.length,
    };
  }, [blueprint]);

  const label = (item: Named) => item[key] || item[other];

  function renamed<T extends Named>(item: T, value: string): T {
    const name = value.slice(0, BLUEPRINT_LIMITS.name);
    return item[other] === item[key] ? { ...item, name_en: name, name_ar: name } : { ...item, [key]: name };
  }

  function setStages(stages: BlueprintStage[]) {
    onChange({ ...blueprint, stages });
  }

  function updateStage(index: number, stage: BlueprintStage) {
    setStages(blueprint.stages.map((s, i) => (i === index ? stage : s)));
  }

  function updateGrade(stageIndex: number, gradeIndex: number, grade: BlueprintGrade) {
    const stage = blueprint.stages[stageIndex];
    updateStage(stageIndex, { ...stage, grades: stage.grades.map((g, i) => (i === gradeIndex ? grade : g)) });
  }

  // Subjects point at stages by index: drop the removed one and shift the rest.
  function removeStage(index: number) {
    onChange({
      ...blueprint,
      stages: blueprint.stages.filter((_, i) => i !== index),
      subjects: blueprint.subjects
        .map((s) => ({ ...s, stages: s.stages.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)) }))
        .filter((s) => s.stages.length > 0),
    });
  }

  function addStage() {
    const name = t("newStage");
    setStages([
      ...blueprint.stages,
      { name_en: name, name_ar: name, grades: [{ ...sameName(t("newGrade", { n: totals.grades + 1 })), classrooms: ["A"] }] },
    ]);
  }

  function addGrade(stageIndex: number) {
    const stage = blueprint.stages[stageIndex];
    updateStage(stageIndex, {
      ...stage,
      grades: [...stage.grades, { ...sameName(t("newGrade", { n: totals.grades + 1 })), classrooms: ["A"] }],
    });
  }

  const gradesFull = totals.grades >= BLUEPRINT_LIMITS.grades;
  const currencyNames = useMemo(() => new Intl.DisplayNames(locale, { type: "currency" }), [locale]);
  const year = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        {t("totals", totals)}
      </p>

      {blueprint.notes.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-lg border border-brand-accent/40 bg-brand-accent/10 p-3 text-sm">
          {blueprint.notes.map((note) => (
            <li key={note} className="flex gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-brand-accent-strong dark:text-brand-accent" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">{t("structure")}</h3>
        {blueprint.stages.map((stage, s) => (
          <div key={s} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2">
              <InlineName
                value={label(stage)}
                ariaLabel={t("stageName")}
                className="font-medium"
                onChange={(value) => updateStage(s, renamed(stage, value))}
              />
              {blueprint.stages.length > 1 && (
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t("removeStage", { name: label(stage) })} onClick={() => removeStage(s)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>

            <ul className="flex flex-col gap-1.5 ps-3">
              {stage.grades.map((grade, g) => (
                <li key={g} className="flex flex-wrap items-center gap-2 border-s ps-3">
                  <InlineName
                    value={label(grade)}
                    ariaLabel={t("gradeName")}
                    className="w-36 text-sm"
                    onChange={(value) => updateGrade(s, g, renamed(grade, value))}
                  />
                  <div className="flex flex-wrap items-center gap-1">
                    {grade.classrooms.map((section, c) => (
                      <span key={c} className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-xs">
                        <input
                          aria-label={t("classroomName", { grade: label(grade) })}
                          value={section}
                          maxLength={BLUEPRINT_LIMITS.section}
                          size={Math.max(section.length, 1)}
                          onChange={(event) =>
                            updateGrade(s, g, { ...grade, classrooms: grade.classrooms.map((x, i) => (i === c ? event.target.value : x)) })
                          }
                          onBlur={(event) => {
                            if (!event.target.value.trim()) {
                              updateGrade(s, g, { ...grade, classrooms: grade.classrooms.map((x, i) => (i === c ? nextSection(grade.classrooms.filter((_, j) => j !== c)) : x)) });
                            }
                          }}
                          className="bg-transparent text-center outline-none focus-visible:underline"
                        />
                        {grade.classrooms.length > 1 && (
                          <button
                            type="button"
                            aria-label={t("removeClassroom", { name: section })}
                            onClick={() => updateGrade(s, g, { ...grade, classrooms: grade.classrooms.filter((_, i) => i !== c) })}
                            className="rounded text-muted-foreground hover:text-foreground"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </span>
                    ))}
                    {grade.classrooms.length < BLUEPRINT_LIMITS.classroomsPerGrade && (
                      <button
                        type="button"
                        aria-label={t("addClassroom", { grade: label(grade) })}
                        onClick={() => updateGrade(s, g, { ...grade, classrooms: [...grade.classrooms, nextSection(grade.classrooms)] })}
                        className="inline-flex size-5 items-center justify-center rounded-md border border-dashed text-muted-foreground hover:border-brand-accent hover:text-foreground"
                      >
                        <Plus className="size-3" />
                      </button>
                    )}
                  </div>
                  {stage.grades.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="ms-auto"
                      aria-label={t("removeGrade", { name: label(grade) })}
                      onClick={() => updateStage(s, { ...stage, grades: stage.grades.filter((_, i) => i !== g) })}
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <Button type="button" variant="ghost" size="sm" className="self-start" disabled={gradesFull} onClick={() => addGrade(s)}>
              <Plus className="size-4" />
              {t("addGrade")}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={blueprint.stages.length >= BLUEPRINT_LIMITS.stages || gradesFull}
          onClick={addStage}
        >
          <Plus className="size-4" />
          {t("addStage")}
        </Button>
        {gradesFull && <p className="text-xs text-muted-foreground">{t("gradesFull", { max: BLUEPRINT_LIMITS.grades })}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t("subjects")}</h3>
        {blueprint.subjects.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("noSubjects")}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {blueprint.subjects.map((subject, i) => (
              <li key={subject.name_en} className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs">
                <span>{label(subject)}</span>
                <span className="text-muted-foreground">· {subject.stages.map((idx) => label(blueprint.stages[idx])).join(", ")}</span>
                <button
                  type="button"
                  aria-label={t("removeSubject", { name: label(subject) })}
                  onClick={() => onChange({ ...blueprint, subjects: blueprint.subjects.filter((_, j) => j !== i) })}
                  className="rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t("subjectsHint")}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>{t("academicYear")}</Label>
          <Select
            items={[year - 1, year, year + 1].map((y) => ({ value: String(y), label: `${y}/${y + 1}` }))}
            value={String(blueprint.academic_year)}
            onValueChange={(value) => value && onChange({ ...blueprint, academic_year: Number(value) })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[year - 1, year, year + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>{`${y}/${y + 1}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("currency")}</Label>
          <Select
            items={SCHOOL_CURRENCIES.map((code) => ({ value: code, label: `${code} — ${currencyNames.of(code) ?? code}` }))}
            value={blueprint.currency}
            onValueChange={(value) => onChange({ ...blueprint, currency: value ?? null })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("chooseLater")} />
            </SelectTrigger>
            <SelectContent>
              {SCHOOL_CURRENCIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {`${code} — ${currencyNames.of(code) ?? code}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>{t("schoolDays")}</Label>
          <SchoolWeekField
            value={blueprint.school_days?.join(",") ?? ""}
            onChange={(value) => onChange({ ...blueprint, school_days: value ? value.split(",").map(Number) : null })}
          />
          {!blueprint.school_days && <p className="text-xs text-muted-foreground">{t("schoolDaysLater")}</p>}
        </div>
      </section>
    </div>
  );
}

/** A name that looks like text until focused. Empty on blur → the previous name stays. */
function InlineName({
  value,
  onChange,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <Input
      aria-label={ariaLabel}
      value={value}
      maxLength={BLUEPRINT_LIMITS.name}
      onChange={(event) => event.target.value.trim() && onChange(event.target.value)}
      className={cn(
        "h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent",
        className
      )}
    />
  );
}

function sameName(name: string): Named {
  return { name_en: name, name_ar: name };
}

/** The next free letter after the sections used (A, B → C), or the next number. */
function nextSection(used: string[]): string {
  const taken = new Set(used.map((s) => s.trim().toUpperCase()));
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (!taken.has(letter)) return letter;
  }
  let n = used.length + 1;
  while (taken.has(String(n))) n++;
  return String(n);
}
