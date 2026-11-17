"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Video } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageLoader } from "@/components/page-loader";
import { TableSkeletonRows } from "@/components/table-skeleton";
import type { StudentMeeting } from "./types";

export function StudentMeetingsPage() {
  const t = useTranslations("StudentMeetingsPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/my-meetings");
    }
  }, [isAuthLoading, user, router]);

  useEffect(() => {
    if (!isAuthLoading && user && !hasRole("student")) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, user, hasRole, router]);

  const {
    data: meetings = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["student-meetings"],
    queryFn: () =>
      apiFetch<{ meetings: StudentMeeting[] }>("/api/student/meetings").then((d) => d.meetings),
    enabled: !isAuthLoading && !!user && hasRole("student"),
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [meetings.length, isLoading],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("heading")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>

        {!isLoading && meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noMeetings")}</p>
        ) : (
          <div ref={rowsRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("titleColumn")}</TableHead>
                  <TableHead>{t("teacherColumn")}</TableHead>
                  <TableHead>{t("startTimeColumn")}</TableHead>
                  <TableHead>{t("durationColumn")}</TableHead>
                  <TableHead className="text-end">{t("actionsColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeletonRows columns={5} />
                ) : (
                  meetings.map((meeting) => (
                    <TableRow key={meeting.id}>
                      <TableCell>{meeting.title}</TableCell>
                      <TableCell>{meeting.teacher_name}</TableCell>
                      <TableCell>{new Date(meeting.start_time).toLocaleString(locale)}</TableCell>
                      <TableCell>{t("minutes", { count: meeting.duration_minutes })}</TableCell>
                      <TableCell className="text-end">
                        <Button
                          nativeButton={false}
                          size="sm"
                          render={
                            <a href={meeting.join_url} target="_blank" rel="noopener noreferrer" />
                          }
                        >
                          <Video className="size-4" />
                          {t("join")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </main>
  );
}
