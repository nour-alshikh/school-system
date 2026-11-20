// next-intl's client hooks come from use-intl; re-exporting them avoids
// pulling Next.js into the video bundle.
export { useTranslations, useLocale, useFormatter, useMessages, useNow, useTimeZone, IntlProvider as NextIntlClientProvider } from "use-intl";
