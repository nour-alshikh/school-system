/**
 * Formats an amount (the API sends decimals as strings, e.g. "1500.00") in
 * a school's currency, in the UI's language: "EGP 1,500.00" /
 * "١٬٥٠٠٫٠٠ ج.م.‏". Before the school's admin has chosen a currency it's a
 * plain number with two decimals, as the app always showed it.
 */
export function formatMoney(
  amount: string | number | null | undefined,
  currency: string | null | undefined,
  locale: string
): string {
  const value = Number(amount ?? 0);

  if (!currency) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
    }).format(value);
  } catch {
    // An unknown code (RangeError) shouldn't break a fees page.
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** Currencies a school's admin can pick. Mirrors config/schools.php. */
export const SCHOOL_CURRENCIES = [
  "EGP", "SAR", "AED", "KWD", "QAR", "BHD", "OMR", "JOD", "IQD", "LBP",
  "SYP", "YER", "LYD", "TND", "DZD", "MAD", "SDG", "USD", "EUR", "GBP",
  "TRY",
] as const;
