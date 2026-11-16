import type {
  AdminDashboardAttendanceDayType,
  AdminDashboardFeeMonthType,
} from "@/types/generated";

/** Share of marked students who came (present or late), 0–100, or null when nothing was marked. */
export function attendanceRate(day: AdminDashboardAttendanceDayType): number | null {
  const marked = day.present + day.late + day.absent + day.excused;
  return marked === 0 ? null : ((day.present + day.late) / marked) * 100;
}

/** The trend's days that had any attendance marked, with their rate. */
export function markedDays(trend: AdminDashboardAttendanceDayType[]) {
  return trend.flatMap((day) => {
    const rate = attendanceRate(day);
    return rate === null ? [] : [{ ...day, rate }];
  });
}

/** % change from `previous` to `current`, or null when there is no base to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function collected(month: AdminDashboardFeeMonthType | undefined): number {
  return Number(month?.collected ?? 0);
}

/**
 * Locale for Intl. Plain "ar" (Western digits) rather than "ar-EG", so the
 * dashboard's numbers match its money amounts, which formatMoney formats
 * with the plain locale.
 */
export function intlLocale(locale: string): string {
  return locale === "ar" ? "ar" : "en-US";
}

export function formatNumber(value: number, locale: string, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits }).format(value);
}

export function formatPercent(value: number, locale: string, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "percent",
    maximumFractionDigits,
  }).format(value / 100);
}

/** "Nov 16" from "2026-11-16". */
export function shortDate(date: string, locale: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "short", day: "numeric" }).format(
    new Date(y, m - 1, d)
  );
}

/** "Nov" from "2026-11". */
export function shortMonth(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "short" }).format(new Date(y, m - 1, 1));
}

/** "Good morning" / "afternoon" / "evening" message key for the current hour. */
export function greetingKey(hour = new Date().getHours()) {
  if (hour < 12) return "greetingMorning" as const;
  if (hour < 18) return "greetingAfternoon" as const;
  return "greetingEvening" as const;
}
