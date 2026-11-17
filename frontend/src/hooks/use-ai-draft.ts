"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { FieldPath, FieldValues, PathValue, UseFormReturn } from "react-hook-form";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";

/**
 * Whether "Draft with AI" works for this user right now: the server checks
 * the key, the plan's "ai" feature and the school's ai_enabled setting and
 * sends the answer as user.ai_available. AI buttons render only when true,
 * so every form still works by hand without it (docs/ai-assistant-plan.md, rule 6).
 */
export function useAiAvailable(): boolean {
  const { user } = useAuth();
  return !!user?.ai_available;
}

/** How long fields filled by AI keep their amber highlight. */
const HIGHLIGHT_MS = 2500;

const HIGHLIGHT_CLASS = "ring-2 ring-brand-accent/70 bg-brand-accent/5 transition-[box-shadow,background-color] duration-500";

export interface UseAiDraftOptions<TValues extends FieldValues, TDraft> {
  form: UseFormReturn<TValues>;
  /** The draft kind: POST /api/ai/draft/{kind}. */
  kind: string;
  /** Overrides the URL, for drafts with their own route (platform announcements). */
  endpoint?: string;
  /** Extra facts for the prompt (the exam's subject, …), validated per kind on the server. */
  context?: Record<string, unknown>;
  /** The draft as form values; only the fields returned are touched. */
  toValues: (draft: TDraft) => Partial<TValues>;
}

export type AiDraftController = ReturnType<typeof useAiDraft>;

/**
 * Runs an AI draft and fills a react-hook-form form with it — nothing is
 * saved; the user reviews and presses the form's own Save. Remembers the
 * values it replaced so the draft can be undone, and highlights the filled
 * fields for a moment: put `ai.highlight("field")` in that input's className.
 */
export function useAiDraft<TValues extends FieldValues, TDraft = unknown>({
  form,
  kind,
  endpoint,
  context,
  toValues,
}: UseAiDraftOptions<TValues, TDraft>) {
  const [filled, setFilled] = useState<ReadonlySet<string>>(new Set());
  const [canUndo, setCanUndo] = useState(false);
  const before = useRef<Partial<Record<FieldPath<TValues>, unknown>>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const flash = useCallback((names: string[]) => {
    setFilled(new Set(names));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFilled(new Set()), HIGHLIGHT_MS);
  }, []);

  const setAll = useCallback(
    (values: Partial<Record<FieldPath<TValues>, unknown>>) => {
      for (const [name, value] of Object.entries(values)) {
        form.setValue(name as FieldPath<TValues>, value as PathValue<TValues, FieldPath<TValues>>, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    },
    [form]
  );

  const mutation = useMutation({
    mutationFn: (notes: string) =>
      apiFetch<{ draft: TDraft }>(endpoint ?? `/api/ai/draft/${kind}`, {
        method: "POST",
        body: JSON.stringify(context ? { notes, context } : { notes }),
      }).then((d) => d.draft),
    onSuccess: (draft) => {
      const values = toValues(draft) as Partial<Record<FieldPath<TValues>, unknown>>;
      const names = Object.keys(values) as FieldPath<TValues>[];
      before.current = Object.fromEntries(names.map((name) => [name, form.getValues(name)])) as typeof before.current;
      setAll(values);
      setCanUndo(true);
      flash(names);
    },
  });

  const undo = useCallback(() => {
    setAll(before.current);
    setCanUndo(false);
    flash(Object.keys(before.current));
  }, [setAll, flash]);

  const highlight = useCallback(
    (name: FieldPath<TValues>) => (filled.has(name) ? HIGHLIGHT_CLASS : undefined),
    [filled]
  );

  return {
    /** Sends the notes; resolves with the draft once the form is filled. */
    draft: mutation.mutateAsync,
    isPending: mutation.isPending,
    canUndo,
    undo,
    highlight,
  };
}
