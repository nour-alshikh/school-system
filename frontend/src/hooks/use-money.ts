import { useCallback } from "react";
import { useLocale } from "next-intl";
import { formatMoney } from "@/lib/money";
import { useSchoolSettings } from "@/hooks/use-school-settings";

/**
 * Formats amounts in a currency: the one given (parent/student fee pages
 * get it with their data, since a child's school may not be the one the
 * user is signed in to), or else the current school's.
 */
export function useMoney(currencyOverride?: string | null) {
  const locale = useLocale();
  const { data: settings } = useSchoolSettings();

  const currency =
    currencyOverride !== undefined
      ? currencyOverride
      : (settings?.find((s) => s.key === "currency")?.value ?? null);

  return useCallback(
    (amount: string | number | null | undefined) =>
      formatMoney(amount, currency, locale),
    [currency, locale]
  );
}
