"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PageLoader } from "@/components/page-loader";
import { SettingsForm } from "./settings-form";
import type { Setting } from "./types";

export function SettingsPage() {
  // useSearchParams (for ?tab=) needs a Suspense boundary.
  return (
    <Suspense fallback={<PageLoader />}>
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const t = useTranslations("SettingsPage");
  const { user, isLoading: isAuthLoading, can } = useAuth();
  const router = useRouter();

  const isAuthorized = can("manage-settings");

  useEffect(() => {
    if (!isAuthLoading && (!user || !isAuthorized)) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, isAuthorized, router]);

  const {
    data: settings = [],
    isLoading: isLoadingSettings,
    error: settingsError,
  } = useQuery({
    queryKey: ["settings"],
    queryFn: () =>
      apiFetch<{ settings: Setting[] }>("/api/settings").then(
        (data) => data.settings
      ),
    // The permission check above is only a UX shortcut; the API is the real
    // authority, so don't even fetch until it's known to have passed.
    enabled: !isAuthLoading && isAuthorized,
  });

  useEffect(() => {
    if (!settingsError) return;

    toast.error(
      settingsError instanceof ApiError ? settingsError.message : t("loadError")
    );
  }, [settingsError, t]);

  if (isAuthLoading || !user || !isAuthorized || isLoadingSettings) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{t("heading")}</h1>

      {settingsError ? (
        <p className="text-sm text-muted-foreground">{t("loadError")}</p>
      ) : (
        <SettingsForm
          settings={settings}
          initialTab={searchParams.get("tab") ?? undefined}
        />
      )}
    </main>
  );
}
