"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Check, ChevronDown, Settings2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AcademicYearType } from "@/types/generated";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The school's current academic year in the top bar, with the other years
 * and a way to manage them. The current year is a school-wide setting
 * (`is_current`), changed on the academic years page — not a per-user view
 * filter — so the years here are shown, not picked.
 */
export function AcademicYearMenu() {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useAuth();
  // Same gate as GET /api/academic-years.
  const allowed = can("manage-academics") || can("manage-students");

  const { data: years } = useQuery({
    queryKey: ["academic-years", "all"],
    queryFn: () => apiFetch<{ academic_years: AcademicYearType[] }>("/api/academic-years").then((d) => d.academic_years),
    enabled: allowed,
    staleTime: 5 * 60 * 1000,
  });

  if (!allowed || !years) return null;

  const name = (y: AcademicYearType) => (locale === "ar" ? y.name_ar : y.name_en);
  const current = years.find((y) => y.is_current);
  // Newest first.
  const sorted = [...years].sort((a, b) => b.year - a.year);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hidden h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex"
        aria-label={t("academicYear")}
        title={t("academicYear")}
      >
        <CalendarRange className="size-4 text-muted-foreground" />
        <span className="max-w-32 truncate">{current ? name(current) : t("noCurrentYear")}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {/* Plain divs, not DropdownMenuLabel — that one throws outside a
            <Menu.Group>, and these rows are information, not actions. */}
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{t("academicYears")}</div>
        {sorted.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">{t("noCurrentYear")}</div>}
        {sorted.map((y) => (
          <div
            key={y.id}
            className={cn("flex items-center gap-2 px-2 py-1.5 text-sm", !y.is_current && "text-muted-foreground")}
          >
            <span className="flex-1 truncate">{name(y)}</span>
            {y.is_current && (
              <span className="flex items-center gap-1 text-xs font-medium text-primary">
                <Check className="size-3.5" />
                {t("currentYear")}
              </span>
            )}
          </div>
        ))}
        {can("manage-academics") && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/academic-years")}>
              <Settings2 />
              {t("manageAcademicYears")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
