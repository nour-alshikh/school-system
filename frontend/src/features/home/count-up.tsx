"use client";

import { useRef } from "react";
import { useLocale } from "next-intl";
import { useGSAP } from "@gsap/react";
import { gsap, onScrollIn, prefersReducedMotion } from "@/lib/gsap";
import { formatNumber } from "@/features/admin-dashboard/utils";

/**
 * A number that counts up from zero when it scrolls into view. Renders the
 * final value first, so it's right without JavaScript and under reduced
 * motion.
 */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const locale = useLocale();
  const ref = useRef<HTMLSpanElement>(null);
  const format = (n: number) => `${formatNumber(Math.round(n), locale)}${suffix}`;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      const counter = { n: 0 };
      gsap.to(counter, {
        n: value,
        duration: 1.2,
        ease: "power1.out",
        scrollTrigger: onScrollIn(el),
        onStart: () => {
          el.textContent = format(0);
        },
        onUpdate: () => {
          el.textContent = format(counter.n);
        },
      });
    },
    { scope: ref, dependencies: [value, locale] }
  );

  return (
    <span ref={ref} className="tabular-nums">
      {format(value)}
    </span>
  );
}
