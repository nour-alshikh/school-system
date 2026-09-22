"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CalendarEventForm } from "./calendar-event-form";
import type { CalendarEvent } from "./types";

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

// 6 full weeks (42 days), padded with the trailing days of the previous/next
// month, so the grid height never shifts between months.
function getMonthGrid(monthDate: Date): Date[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const gridStart = new Date(year, month, 1 - startWeekday);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

// Jan 1 2023 was a Sunday, so weekday index 0..6 from that reference week
// lines up with Date#getDay()'s 0 (Sun)..6 (Sat) — used only to get each
// weekday's localized short name.
function weekdayLabels(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: "short",
  });
  return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(2023, 0, i + 1)));
}

export function Calendar() {
  const t = useTranslations("CalendarPage");
  const locale = useLocale();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can("manage-calendar");

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);

  const { data: events = [], error } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: () =>
      apiFetch<{ calendar_events: CalendarEvent[] }>("/api/calendar-events").then(
        (d) => d.calendar_events
      ),
  });

  if (error) {
    toast.error(error instanceof ApiError ? error.message : t("loadError"));
  }

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  const deleteMutation = useMutation({
    mutationFn: (event: CalendarEvent) =>
      apiFetch<void>(`/api/calendar-events/${event.id}`, { method: "DELETE" }),
    onSuccess: (_data, event) => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success(t("deleteSuccess"));
      if (editingEvent?.id === event.id) setEditingEvent(null);
      setDeletingEvent(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("deleteError"));
    },
  });

  const grid = useMemo(() => getMonthGrid(currentMonth), [currentMonth]);
  const weekdays = useMemo(() => weekdayLabels(locale), [locale]);
  const today = new Date();

  const monthLabel = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(currentMonth);

  function goToMonth(offset: number) {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  }

  function openDay(dateKey: string) {
    setSelectedDate(dateKey);
    setEditingEvent(null);
  }

  const selectedDateEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : [];
  const selectedDateLabel = selectedDate
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date(`${selectedDate}T00:00:00`))
    : "";

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t("previousMonth")}
            onClick={() => goToMonth(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t("nextMonth")}
            onClick={() => goToMonth(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border text-center text-xs">
        {weekdays.map((label, i) => (
          <div key={i} className="bg-muted py-1 font-medium text-muted-foreground">
            {label}
          </div>
        ))}

        {grid.map((date) => {
          const dateKey = toDateKey(date);
          const inCurrentMonth = date.getMonth() === currentMonth.getMonth();
          const dayEvents = eventsByDate.get(dateKey) ?? [];

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => openDay(dateKey)}
              className={cn(
                "flex min-h-16 flex-col items-start gap-1 bg-background p-1 text-start hover:bg-accent",
                !inCurrentMonth && "text-muted-foreground/50"
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-xs",
                  isSameDay(date, today) && "bg-primary text-primary-foreground"
                )}
              >
                {date.getDate()}
              </span>
              {dayEvents.slice(0, 2).map((event) => (
                <span
                  key={event.id}
                  className="w-full truncate rounded bg-primary/10 px-1 text-[10px] text-primary"
                >
                  {event.title}
                </span>
              ))}
              {dayEvents.length > 2 && (
                <span className="text-[10px] text-muted-foreground">
                  {t("moreEvents", { count: dayEvents.length - 2 })}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Dialog
        open={!!selectedDate}
        onOpenChange={(open) => !open && setSelectedDate(null)}
      >
        <DialogContent className="max-h-[85vh] sm:max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDateLabel}</DialogTitle>
          </DialogHeader>

          {selectedDateEvents.length > 0 && (
            <ul className="flex flex-col gap-2">
              {selectedDateEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex items-start justify-between gap-2 rounded-md border p-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{event.title}</p>
                    {event.description && (
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {event.description}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={t("edit")}
                        title={t("edit")}
                        onClick={() => setEditingEvent(event)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-sm"
                        aria-label={t("delete")}
                        title={t("delete")}
                        disabled={deleteMutation.isPending && deleteMutation.variables?.id === event.id}
                        onClick={() => setDeletingEvent(event)}
                      >
                        {deleteMutation.isPending && deleteMutation.variables?.id === event.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canManage && selectedDate && (
            <div className="flex flex-col gap-2 border-t pt-4">
              <h4 className="flex items-center gap-1 text-sm font-medium">
                {editingEvent ? (
                  t("editEvent")
                ) : (
                  <>
                    <Plus className="size-4" /> {t("addEvent")}
                  </>
                )}
              </h4>
              <CalendarEventForm
                key={editingEvent?.id ?? "new"}
                date={selectedDate}
                event={editingEvent ?? undefined}
                onSuccess={() => setEditingEvent(null)}
                onCancel={editingEvent ? () => setEditingEvent(null) : undefined}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingEvent}
        onOpenChange={(open) => !open && setDeletingEvent(null)}
        title={t("confirmDeleteTitle")}
        description={t("confirmDeleteDescription", {
          title: deletingEvent?.title ?? "",
        })}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingEvent && deleteMutation.mutate(deletingEvent)}
      />
    </section>
  );
}
