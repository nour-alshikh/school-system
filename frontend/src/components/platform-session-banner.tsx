"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Eye, LogOut } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";

/**
 * On every page while a system admin is inside a school as its admin
 * (docs/central-dashboard-plan.md, phase 5): whose school it is, that
 * everything is logged, when the session ends, and the way out.
 */
export function PlatformSessionBanner() {
  const t = useTranslations("PlatformSessionBanner");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const router = useRouter();
  const { user, exitSchool } = useAuth();
  const [leaving, setLeaving] = useState(false);

  const actingAs = user?.acting_as;
  if (!actingAs) return null;

  async function leave() {
    if (!actingAs) return;
    setLeaving(true);
    try {
      await exitSchool();
      router.replace(`/platform/schools/${actingAs.school_id}`);
      router.refresh();
    } catch {
      toast.error(tErrors("somethingWentWrong"));
    } finally {
      setLeaving(false);
    }
  }

  const endsAt = new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(new Date(actingAs.expires_at));

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-amber-500/40 bg-amber-100 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100 print:hidden"
    >
      <span className="flex items-center gap-2">
        <Eye className="size-4 shrink-0" />
        {t.rich("message", {
          school: actingAs.school_name,
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </span>
      <span className="text-xs opacity-80">{t("endsAt", { time: endsAt })}</span>
      <Button size="sm" variant="outline" className="h-7 border-amber-600/50 bg-transparent" onClick={leave} disabled={leaving}>
        <LogOut className="size-3.5 rtl:rotate-180" />
        {t("exit")}
      </Button>
    </div>
  );
}
