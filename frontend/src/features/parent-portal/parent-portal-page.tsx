"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { PageLoader } from "@/components/page-loader";
import { ProfileForm } from "./profile-form";
import { StudentInfo } from "./student-info";
import {
  useParentChildren,
  useSelectedChild,
} from "@/features/parent-children/use-parent-children";
import { ChildPicker } from "@/features/parent-children/child-picker";

export function ParentPortalPage() {
  const t = useTranslations("ParentPortal");
  const { user, isLoading, hasRole } = useAuth();
  const router = useRouter();
  const { data: children } = useParentChildren(
    !isLoading && !!user && hasRole("parent")
  );
  const { selectedId, select } = useSelectedChild(children);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login?redirect=/parent");
    } else if (!hasRole("parent")) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, hasRole, router]);

  if (isLoading || !user || !hasRole("parent")) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("profileHeading")}</h2>
        <ProfileForm user={user} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("studentHeading")}</h2>
        <ChildPicker
          childList={children ?? []}
          selectedId={selectedId}
          onSelect={select}
        />
        {selectedId !== undefined && <StudentInfo studentId={selectedId} />}
      </section>
    </main>
  );
}
