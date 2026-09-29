"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { loginRoles } from "@/lib/schemas";

function LoginChooser() {
  const t = useTranslations("LoginChooserPage");
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  return (
    <div className="w-full max-w-sm flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-center">{t("heading")}</h1>
      <div className="flex flex-col gap-2">
        {loginRoles.map((role) => (
          <Link
            key={role}
            href={
              redirect
                ? `/login/${role}?redirect=${encodeURIComponent(redirect)}`
                : `/login/${role}`
            }
            className={buttonVariants({ variant: "outline" })}
          >
            {t(role)}
          </Link>
        ))}
      </div>
      <Link
        href="/login/system"
        className="text-center text-xs text-muted-foreground underline"
      >
        {t("systemAdmin")}
      </Link>
      <p className="text-center text-sm">
        {t("newHere")}{" "}
        <Link href="/create-school" className="underline">
          {t("createSchoolLink")}
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Suspense fallback={null}>
        <LoginChooser />
      </Suspense>
    </main>
  );
}
