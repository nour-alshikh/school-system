import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toBlueprintPayload } from "./payload";
import type { SchoolBlueprint } from "./types";

export interface BuildBlueprintInput {
  description: string;
  /** The blueprint to change, when refining ("add a secondary stage"). */
  blueprint?: SchoolBlueprint | null;
  /** Honeypot: hidden from people, left empty. */
  website?: string;
}

export interface BuildBlueprintResult {
  blueprint: SchoolBlueprint;
  /** True when AI couldn't help and this is the standard structure (or the unchanged one). */
  fallback: boolean;
}

/** POST /api/school-blueprint: public, throttled per address. */
export function useBuildBlueprint() {
  return useMutation({
    mutationFn: ({ description, blueprint, website }: BuildBlueprintInput) =>
      apiFetch<BuildBlueprintResult>("/api/school-blueprint", {
        method: "POST",
        body: JSON.stringify({
          description,
          website: website ?? "",
          ...(blueprint ? { blueprint: toBlueprintPayload(blueprint) } : {}),
        }),
      }),
  });
}
