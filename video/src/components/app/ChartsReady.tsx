import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { continueRender, delayRender } from "remotion";

/**
 * Recharts' ResponsiveContainer (used by KpiCard's sparkline) measures itself
 * asynchronously, so a frame captured right after mount would show an empty
 * chart. This holds the frame until every chart inside has drawn its SVG
 * (or 3s pass), each time the wrapped content mounts.
 */
export function ChartsReady({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [handle] = useState(() => delayRender("Waiting for Recharts to measure"));

  useLayoutEffect(() => {
    let raf = 0;
    const started = performance.now();
    const check = () => {
      const charts = Array.from(ref.current?.querySelectorAll(".recharts-responsive-container") ?? []);
      const ready = charts.every((c) => c.querySelector("svg.recharts-surface"));
      if (ready || performance.now() - started > 3000) continueRender(handle);
      else raf = requestAnimationFrame(check);
    };
    check();
    return () => cancelAnimationFrame(raf);
  }, [handle]);

  return <div ref={ref}>{children}</div>;
}
