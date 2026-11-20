import { school } from "../mock";

/** The real hook loads /api/settings; the video reads mock.ts instead. */
export function useSchoolSettings() {
  return { data: school.settings, isLoading: false, isError: false } as const;
}

export function useSchoolDays(): number[] | null {
  const value = school.settings.find((s) => s.key === "school_days")?.value;
  return value ? value.split(",").map(Number) : null;
}

/** Same logic as the app's isSchoolDay. */
export function isSchoolDay(date: string, schoolDays: number[] | null): boolean {
  if (!schoolDays || !date) return true;
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return schoolDays.includes(new Date(year, month - 1, day).getDay());
}
