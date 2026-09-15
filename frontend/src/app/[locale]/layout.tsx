import type { Metadata } from "next";
import { Cairo, Geist, Geist_Mono } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { routing } from "@/i18n/routing";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { SiteHeader } from "@/components/site-header";
import { SiteSidebar } from "@/components/site-sidebar";
import { PageTransition } from "@/components/page-transition";
import { Toaster } from "@/components/ui/sonner";
import "../globals.css";

// Geist has no Arabic glyphs, so it's the default (--font-sans, see
// globals.css) for the LTR/English route; Cairo (Latin + Arabic) takes over
// under [dir="rtl"] instead of switching the whole app to one font.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["latin", "arabic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return { title: t("title"), description: t("description") };
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();

  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geistSans.variable} ${cairo.variable} ${geistMono.variable} h-full antialiased`}
      // next-themes sets the `dark` class via a blocking script before
      // hydration (see globals.css's `.dark` block) — this class attribute
      // is expected to differ from the server-rendered markup.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NextIntlClientProvider>
            <QueryProvider>
              <AuthProvider>
                <SiteHeader />
                <div className="flex flex-1">
                  <SiteSidebar />
                  <PageTransition>{children}</PageTransition>
                </div>
                <Toaster />
              </AuthProvider>
            </QueryProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
