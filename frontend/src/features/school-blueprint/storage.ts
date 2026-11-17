import type { SchoolBlueprint } from "./types";

/**
 * The blueprint travels from the landing page to /create-school in
 * sessionStorage (docs/ai-assistant-plan.md, phase 2): it's only needed in
 * this tab, until signup. Storage can be unavailable (private mode,
 * blocked site data), so every access is guarded and a missing blueprint
 * just means the plain signup form.
 */
const KEY = "school-blueprint";

export interface StoredBlueprint {
  blueprint: SchoolBlueprint;
  /** What the visitor typed, shown above the preview. */
  description: string;
}

export function loadBlueprint(): StoredBlueprint | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBlueprint;
    return Array.isArray(parsed?.blueprint?.stages) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveBlueprint(value: StoredBlueprint): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Not stored: the page keeps it in memory instead.
  }
}

export function clearBlueprint(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
