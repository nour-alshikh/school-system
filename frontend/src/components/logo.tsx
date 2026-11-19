import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The School System logo (public/logos). The full logo has its words in
 * teal on light backgrounds (full-01) and in white on dark ones (full-04,
 * the same design), switched by the theme's `.dark` class. Decorative by
 * default: put the brand name in the surrounding link's label.
 */
export function Logo({ className, alt = "" }: { className?: string; alt?: string }) {
  return (
    <span className={cn("inline-flex shrink-0", className)}>
      <Image src="/logos/full-01.svg" alt={alt} width={284} height={120} className="h-full w-auto dark:hidden" priority />
      <Image src="/logos/full-04.svg" alt={alt} width={284} height={120} className="hidden h-full w-auto dark:block" priority />
    </span>
  );
}

/** The mark alone (icon-01, also the favicon): for tight spots like a collapsed sidebar. */
export function LogoIcon({ className, alt = "" }: { className?: string; alt?: string }) {
  return (
    <Image src="/logos/icon-01.svg" alt={alt} width={120} height={120} className={cn("shrink-0", className)} />
  );
}
