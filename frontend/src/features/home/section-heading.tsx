import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  heading,
  subtext,
  center = false,
}: {
  eyebrow: string;
  heading: string;
  subtext?: string;
  center?: boolean;
}) {
  return (
    <div className={cn("flex max-w-2xl flex-col gap-3", center && "mx-auto items-center text-center")}>
      <span className="text-sm font-semibold text-primary">{eyebrow}</span>
      <h2 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">{heading}</h2>
      {subtext && <p className="text-lg leading-relaxed text-muted-foreground">{subtext}</p>}
    </div>
  );
}
