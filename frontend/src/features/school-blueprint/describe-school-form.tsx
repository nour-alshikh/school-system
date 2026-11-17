"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SchoolBlueprint } from "./types";
import { useBuildBlueprint, type BuildBlueprintResult } from "./use-build-blueprint";

const MAX = 500;
const EXAMPLES = ["example1", "example2", "example3"] as const;

/**
 * "Describe your school…" (docs/ai-assistant-plan.md, phase 2): one box,
 * example chips that fill it, and a button that turns it into a blueprint.
 * On the landing hero and on /create-school; with `current` it refines that
 * blueprint instead ("add a secondary stage").
 */
export function DescribeSchoolForm({
  onBuilt,
  current,
  variant = "hero",
  className,
}: {
  onBuilt: (result: BuildBlueprintResult, description: string) => void;
  current?: SchoolBlueprint | null;
  variant?: "hero" | "compact";
  className?: string;
}) {
  const t = useTranslations("DescribeSchool");
  const tErrors = useTranslations("Errors");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const build = useBuildBlueprint();
  const refining = !!current;

  function submit() {
    const text = description.trim();
    if (!text || build.isPending) return;
    build.mutate(
      { description: text, blueprint: current, website },
      {
        onSuccess: (result) => {
          if (result.fallback) toast.info(refining ? t("unchangedToast") : t("fallbackToast"));
          onBuilt(result, text);
          if (refining) setDescription("");
        },
        onError: (err) =>
          toast.error(
            err instanceof ApiError && err.status === 429
              ? t("tooMany")
              : err instanceof ApiError
                ? err.message
                : tErrors("somethingWentWrong")
          ),
      }
    );
  }

  return (
    <form
      className={cn("relative flex w-full flex-col gap-3", className)}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div
        className={cn(
          "flex flex-col gap-2 rounded-xl border bg-card/90 p-2 shadow-sm backdrop-blur focus-within:ring-3 focus-within:ring-ring/40",
          variant === "hero" && "shadow-lg shadow-primary/10 dark:shadow-black/30"
        )}
      >
        <label htmlFor={refining ? "refine-school" : "describe-school"} className="sr-only">
          {refining ? t("refineLabel") : t("label")}
        </label>
        <Textarea
          id={refining ? "refine-school" : "describe-school"}
          rows={variant === "hero" ? 3 : 2}
          maxLength={MAX}
          value={description}
          disabled={build.isPending}
          placeholder={refining ? t("refinePlaceholder") : t("placeholder")}
          onChange={(event) => setDescription(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              submit();
            }
          }}
          className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        {/* Honeypot: invisible and skipped by keyboard, screen readers and autofill.
            Clipped in place, not pushed off-screen: -left-9999px widens the page in RTL. */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="pointer-events-none absolute top-0 start-0 size-px overflow-hidden opacity-0 [clip-path:inset(50%)]"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs text-muted-foreground tabular-nums">
            {description.length}/{MAX}
          </span>
          <Button type="submit" size={variant === "hero" ? "default" : "sm"} disabled={!description.trim() || build.isPending}>
            {build.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {build.isPending ? t("building") : refining ? t("refine") : t("build")}
          </Button>
        </div>
      </div>

      {!refining && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("tryLabel")}</span>
          {EXAMPLES.map((key) => (
            <button
              key={key}
              type="button"
              disabled={build.isPending}
              onClick={() => setDescription(t(key))}
              className="rounded-full border bg-background/80 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-brand-accent hover:text-foreground disabled:opacity-50"
            >
              {t(`${key}Chip`)}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
