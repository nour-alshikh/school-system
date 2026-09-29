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
import { PlatformSessionBanner } from "@/components/platform-session-banner";
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

// Server-only: talks to Laravel directly (not through the BFF proxy in
// src/app/api/[...path]/route.ts — that exists to attach the browser's
// auth cookie, which this render-time fetch has no use for) since
// /api/settings is public. `revalidate` keeps every page render from
// re-fetching it — an admin's own settings save invalidates the client's
// react-query cache instantly, but the site's <head> metadata catching up
// within 5 minutes is an acceptable trade-off for not hitting Laravel on
// every request.
async function fetchSeoSettings(): Promise<{
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
}> {
  const LARAVEL_API_URL = process.env.LARAVEL_API_URL ?? "http://localhost:8000";

  try {
    const response = await fetch(`${LARAVEL_API_URL}/api/settings`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error("Failed to load settings");

    const { settings } = (await response.json()) as {
      settings: { key: string; value: string | null; file_url: string | null }[];
    };
    const byKey = new Map(settings.map((s) => [s.key, s]));

    return {
      meta_title: byKey.get("meta_title")?.value ?? null,
      meta_description: byKey.get("meta_description")?.value ?? null,
      og_image: byKey.get("og_image")?.file_url ?? null,
    };
  } catch {
    // Laravel unreachable at build/render time — fall back to the i18n
    // defaults below rather than failing the whole page render.
    return { meta_title: null, meta_description: null, og_image: null };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const seo = await fetchSeoSettings();

  const title = seo.meta_title || t("title");
  const description = seo.meta_description || t("description");

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(seo.og_image && { images: [{ url: seo.og_image }] }),
    },
  };
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
                <PlatformSessionBanner />
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
