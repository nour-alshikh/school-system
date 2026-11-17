"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlueprintEditor } from "./blueprint-editor";
import { DescribeSchoolForm } from "./describe-school-form";
import type { BuildBlueprintResult } from "./use-build-blueprint";
import type { SchoolBlueprint } from "./types";

/**
 * Beside the signup form on /create-school: what the school will start
 * with, editable, plus "describe again" to change it in words and a way to
 * start empty instead.
 */
export function BlueprintPanel({
  blueprint,
  description,
  onChange,
  onRefined,
  onDiscard,
}: {
  blueprint: SchoolBlueprint;
  description: string;
  onChange: (next: SchoolBlueprint) => void;
  onRefined: (result: BuildBlueprintResult, description: string) => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("BlueprintEditor");

  return (
    <section aria-labelledby="blueprint-heading" className="flex w-full flex-col gap-5 rounded-2xl border bg-muted/30 p-5">
      <div className="flex flex-col gap-1.5">
        <h2 id="blueprint-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="size-4.5 text-brand-accent-strong dark:text-brand-accent" />
          {t("heading")}
        </h2>
        {description && <p className="text-sm text-muted-foreground">“{description}”</p>}
        <p className="text-xs text-muted-foreground">{t("subheading")}</p>
      </div>

      <BlueprintEditor blueprint={blueprint} onChange={onChange} />

      <div className="flex flex-col gap-2 border-t pt-4">
        <h3 className="text-sm font-medium">{t("describeAgain")}</h3>
        <DescribeSchoolForm variant="compact" current={blueprint} onBuilt={onRefined} />
      </div>

      <Button type="button" variant="link" size="sm" className="self-start px-0 text-muted-foreground" onClick={onDiscard}>
        {t("discard")}
      </Button>
    </section>
  );
}
