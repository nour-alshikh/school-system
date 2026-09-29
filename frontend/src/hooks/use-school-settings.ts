import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { SettingType } from "@/types/generated";

/**
 * The current school's settings — the same query (and cache entry) the
 * settings page uses. /api/settings is public and answers for the school
 * the user is signed in to.
 */
export function useSchoolSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () =>
      apiFetch<{ settings: SettingType[] }>("/api/settings").then(
        (data) => data.settings
      ),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * The school's days as weekday numbers (0 = Sunday … 6 = Saturday, like
 * Date#getDay), or null until the admin chooses them — then every day
 * counts.
 */
export function useSchoolDays(): number[] | null {
  const { data: settings } = useSchoolSettings();
  const value = settings?.find((s) => s.key === "school_days")?.value;

  return value ? value.split(",").map(Number) : null;
}

/** Whether a "YYYY-MM-DD" date is one of the school's days. */
export function isSchoolDay(date: string, schoolDays: number[] | null): boolean {
  if (!schoolDays || !date) return true;
  // Parsed as a local date: new Date("2026-09-29") would be UTC midnight,
  // which is the previous day west of UTC.
  const [year, month, day] = date.split("-").map(Number);
  return schoolDays.includes(new Date(year, month - 1, day).getDay());
}
