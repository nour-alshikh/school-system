"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";

export type ScreenshotName = "admin" | "teacher" | "parent" | "student";

/**
 * A real screenshot of the app, in the page's language and theme. Both
 * themes are in the markup and CSS shows the right one, so there's no
 * flash while next-themes resolves. Captured by
 * `npm run screenshots:landing` (scripts/capture-landing-screenshots.mjs).
 */
export function Screenshot({
  name,
  alt,
  priority = false,
  sizes = "(min-width: 1024px) 50vw, 100vw",
}: {
  name: ScreenshotName;
  alt: string;
  priority?: boolean;
  sizes?: string;
}) {
  const locale = useLocale() === "ar" ? "ar" : "en";
  const common = { width: 1440, height: 900, sizes, priority, className: "h-auto w-full" };

  return (
    <>
      <Image {...common} src={`/landing/${name}-${locale}-light.jpg`} alt={alt} className={cn(common.className, "dark:hidden")} />
      <Image {...common} src={`/landing/${name}-${locale}-dark.jpg`} alt={alt} className={cn(common.className, "hidden dark:block")} />
    </>
  );
}

/** A minimal browser window around a screenshot. */
export function BrowserFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-2xl shadow-primary/10 ring-1 ring-foreground/5 dark:shadow-black/40",
        className
      )}
    >
      <div className="flex items-center gap-1.5 border-b bg-muted/60 px-3 py-2" dir="ltr" aria-hidden>
        <span className="size-2.5 rounded-full bg-red-400/80" />
        <span className="size-2.5 rounded-full bg-amber-400/80" />
        <span className="size-2.5 rounded-full bg-emerald-400/80" />
        <span className="ms-3 h-4 flex-1 rounded bg-background/80 sm:max-w-64" />
      </div>
      {children}
    </div>
  );
}
