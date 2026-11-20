import type { CSSProperties, ReactNode } from "react";
import { IntlProvider } from "use-intl";
import en from "../../../frontend/messages/en.json";
import ar from "../../../frontend/messages/ar.json";
import "../styles.css";
import "../fonts";

export type Locale = "en" | "ar";

const messages = { en, ar };

/**
 * What the real components need to render: the app's real translations
 * (frontend/messages) and the text direction. Auth, router, API and school
 * settings are stubbed at the bundler level (remotion.config.ts).
 * Nest a second provider with locale="ar" for an Arabic beat.
 */
export function VideoProviders({
  locale = "en",
  children,
  className,
  style,
}: {
  locale?: Locale;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <IntlProvider
      locale={locale}
      messages={messages[locale]}
      timeZone="Africa/Cairo"
      now={new Date("2026-11-19T09:00:00+02:00")}
      onError={(error) => console.warn(`[intl] ${error.message}`)}
    >
      <div dir={locale === "ar" ? "rtl" : "ltr"} lang={locale} className={className} style={style}>
        {children}
      </div>
    </IntlProvider>
  );
}
