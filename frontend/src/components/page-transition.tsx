"use client";

import { useGSAP } from "@gsap/react";
import { useRef, type ReactNode } from "react";

import { usePathname } from "@/i18n/navigation";
import { DURATION, EASE, gsap } from "@/lib/gsap";

export function PageTransition({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.from(ref.current, {
        opacity: 0,
        y: 8,
        duration: DURATION.fast,
        ease: EASE,
      });
    },
    { scope: ref, dependencies: [pathname] },
  );

  return (
    <div ref={ref} className="flex flex-1 flex-col">
      {children}
    </div>
  );
}
