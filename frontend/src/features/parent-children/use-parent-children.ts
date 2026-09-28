"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "@/i18n/navigation";
import { apiFetch } from "@/lib/api";
import type { ParentChildType } from "@/types/generated";

/**
 * Every child of the signed-in parent, at every school they're a parent at
 * (GET /api/parent/children) — see docs/multi-tenancy.md, Decisions.
 */
export function useParentChildren(enabled = true) {
  return useQuery({
    queryKey: ["parent-children"],
    queryFn: () =>
      apiFetch<{ children: ParentChildType[] }>("/api/parent/children").then(
        (d) => d.children
      ),
    enabled,
  });
}

/**
 * Which child a parent page is showing: `?student=<id>` if it's one of
 * theirs, else the first child. Kept in the URL so dashboard links and
 * reloads land on the same child.
 */
export function useSelectedChild(children: ParentChildType[] | undefined) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const requested = Number(searchParams.get("student"));
  const selected =
    children?.find((c) => c.student.id === requested) ?? children?.[0];

  const select = useCallback(
    (studentId: number) => router.replace(`${pathname}?student=${studentId}`),
    [pathname, router]
  );

  return { selected, selectedId: selected?.student.id, select };
}

/** `/api/parent/...?student_id=` for the selected child. */
export function withStudent(path: string, studentId: number): string {
  return `${path}${path.includes("?") ? "&" : "?"}student_id=${studentId}`;
}
