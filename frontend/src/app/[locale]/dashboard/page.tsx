"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { AvatarUploader } from "@/components/avatar-uploader";
import { PageLoader } from "@/components/page-loader";
import { StudentDashboardPage } from "@/features/student-dashboard/student-dashboard-page";
import { TeacherDashboardPage } from "@/features/teacher-dashboard/teacher-dashboard-page";
import { ParentDashboardPage } from "@/features/parent-dashboard/parent-dashboard-page";
import { AdminDashboardPage } from "@/features/admin-dashboard/admin-dashboard-page";

export default function DashboardPage() {
  const t = useTranslations("DashboardPage");
  const { user, isLoading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return <PageLoader />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col items-center justify-center gap-4 p-6">
        <AvatarUploader />
        <h1 className="text-xl font-semibold">
          {t("welcome", { name: user.name })}
        </h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>
      {hasRole("admin") && <AdminDashboardPage />}
      {hasRole("student") && <StudentDashboardPage />}
      {hasRole("teacher") && <TeacherDashboardPage />}
      {hasRole("parent") && <ParentDashboardPage />}
    </div>
  );
}
