"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { AvatarUploader } from "@/components/avatar-uploader";
import { PageSkeleton } from "@/components/page-skeleton";

export default function DashboardPage() {
  const t = useTranslations("DashboardPage");
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return <PageSkeleton />;
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <AvatarUploader />
      <h1 className="text-xl font-semibold">
        {t("welcome", { name: user.name })}
      </h1>
      <p className="text-sm text-muted-foreground">{user.email}</p>
    </main>
  );
}
