import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

/** The logo tile: teal square, white cap, an amber spark in the corner. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20",
        className
      )}
    >
      <GraduationCap className="size-4.5" />
      <span aria-hidden className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full bg-brand-accent ring-2 ring-background" />
    </span>
  );
}
