"use client";

import { useTranslations } from "next-intl";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_ACCOUNTS, DEMO_LOGINS_ENABLED, DEMO_PASSWORD } from "@/lib/demo-accounts";

/**
 * Fills a login form with that role's seeded demo account, so visitors of
 * a demo deployment can try each role. Renders nothing unless
 * NEXT_PUBLIC_DEMO_LOGINS=true.
 */
export function DemoLoginButton({
  role,
  onFill,
}: {
  role: keyof typeof DEMO_ACCOUNTS;
  onFill: (email: string, password: string) => void;
}) {
  const t = useTranslations("DemoLogin");

  if (!DEMO_LOGINS_ENABLED) return null;

  return (
    <div className="flex flex-col gap-1 rounded-md border border-dashed p-3">
      <Button type="button" variant="outline" size="sm" onClick={() => onFill(DEMO_ACCOUNTS[role], DEMO_PASSWORD)}>
        <FlaskConical className="size-4" />
        {t("fill")}
      </Button>
      <p className="text-center text-xs text-muted-foreground" dir="ltr">
        {DEMO_ACCOUNTS[role]} · {DEMO_PASSWORD}
      </p>
    </div>
  );
}
