"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Video } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageLoader } from "@/components/page-loader";
import { TableSkeletonRows } from "@/components/table-skeleton";
import { MeetingForm } from "./meeting-form";
import type { Meeting } from "./types";

type ZoomStatus = { connected: boolean; connected_by: string | null };

export function MeetingsPage() {
  const t = useTranslations("MeetingsPage");
  const locale = useLocale();
  const { user, isLoading: isAuthLoading, can, hasRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const canAccess = can("manage-meetings") || hasRole("teacher");
  const canManageZoom = can("manage-meetings");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingMeeting, setDeletingMeeting] = useState<Meeting | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace("/login?redirect=/meetings");
    }
  }, [isAuthLoading, user, router]);

  const {
    data: meetings = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["meetings"],
    queryFn: () => apiFetch<{ meetings: Meeting[] }>("/api/meetings").then((d) => d.meetings),
    enabled: !isAuthLoading && !!user && canAccess,
  });

  useEffect(() => {
    if (!error) return;
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }, [error, t]);

  const { data: zoomStatus } = useQuery({
    queryKey: ["zoom-status"],
    queryFn: () => apiFetch<ZoomStatus>("/api/zoom/status"),
    enabled: !isAuthLoading && !!user && canAccess,
  });

  // Zoom redirects the browser straight to the Laravel backend, which then
  // bounces it here with ?zoom=connected once the token exchange succeeds
  // — see ZoomController::callback(). Strip the query param after handling
  // it so a refresh doesn't re-fire the toast.
  useEffect(() => {
    if (searchParams.get("zoom") !== "connected") return;
    toast.success(t("zoomConnectSuccess"));
    queryClient.invalidateQueries({ queryKey: ["zoom-status"], exact: false });
    router.replace("/meetings");
  }, [searchParams, queryClient, router, t]);

  const connectMutation = useMutation({
    mutationFn: () => apiFetch<{ url: string }>("/api/zoom/connect-url"),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("zoomConnectError"));
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiFetch<void>("/api/zoom/connection", { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zoom-status"], exact: false });
      toast.success(t("zoomDisconnectSuccess"));
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("zoomDisconnectError"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (meeting: Meeting) =>
      apiFetch<void>(`/api/meetings/${meeting.id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"], exact: false });
      toast.success(t("deleteSuccess"));
      setDeletingMeeting(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
      setDeletingMeeting(null);
    },
  });

  // One mutation backs every row's delete button — `variables` (the meeting
  // passed to `mutate()`) scopes the disabled state to just that row. Same
  // convention as stages-page.tsx's deletingId.
  const deletingId = deleteMutation.isPending ? deleteMutation.variables?.id : undefined;

  const rowsRef = useStaggerIn<HTMLDivElement>({
    selector: "[data-slot='table-body'] [data-slot='table-row']",
    deps: [meetings.length, isLoading],
  });

  if (isAuthLoading || !user) {
    return <PageLoader />;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6">
      {zoomStatus && !zoomStatus.connected && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <span>{canManageZoom ? t("zoomNotConnected") : t("zoomNotConnectedTeacher")}</span>
          {canManageZoom && (
            <Button
              type="button"
              size="sm"
              disabled={connectMutation.isPending}
              onClick={() => connectMutation.mutate()}
            >
              {connectMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {t("connectZoom")}
            </Button>
          )}
        </div>
      )}

      {zoomStatus?.connected && canManageZoom && (
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4 text-sm text-muted-foreground">
          <span>
            {zoomStatus.connected_by
              ? t("zoomConnectedBy", { name: zoomStatus.connected_by })
              : t("zoomConnected")}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disconnectMutation.isPending}
            onClick={() => disconnectMutation.mutate()}
          >
            {disconnectMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("disconnectZoom")}
          </Button>
        </div>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("heading")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!zoomStatus?.connected}
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-4" />
            {t("newMeeting")}
          </Button>
        </div>

        {!isLoading && meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noMeetings")}</p>
        ) : (
          <div ref={rowsRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("titleColumn")}</TableHead>
                  <TableHead>{t("classroomsColumn")}</TableHead>
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
                      <TableCell>{meeting.classrooms.map((c) => c.name).join(", ")}</TableCell>
                      <TableCell>{new Date(meeting.start_time).toLocaleString(locale)}</TableCell>
                      <TableCell>{t("minutes", { count: meeting.duration_minutes })}</TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            render={
                              <a
                                href={meeting.start_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={t("start")}
                                title={t("start")}
                              />
                            }
                          >
                            <Video className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={deletingId === meeting.id}
                            onClick={() => setDeletingMeeting(meeting)}
                            aria-label={t("delete")}
                            title={t("delete")}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] sm:max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("newMeeting")}</DialogTitle>
          </DialogHeader>
          <MeetingForm onSuccess={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingMeeting}
        onOpenChange={(open) => !open && setDeletingMeeting(null)}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingMeeting && deleteMutation.mutate(deletingMeeting)}
      />
    </main>
  );
}
