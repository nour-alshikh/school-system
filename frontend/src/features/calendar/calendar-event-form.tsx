"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createCalendarEventSchema, type CalendarEventFormValues } from "./schema";
import type { CalendarEvent } from "./types";
import { AiDraftButton } from "@/components/ai/ai-draft-button";
import { useAiDraft } from "@/hooks/use-ai-draft";
import { cn } from "@/lib/utils";

/** POST /api/ai/draft/calendar_event (CalendarEventDrafter). */
type CalendarEventDraft = { title: string; description: string; date: string | null };

function valuesFromEvent(event: CalendarEvent): CalendarEventFormValues {
  return {
    title: event.title,
    description: event.description ?? "",
    date: event.date,
  };
}

export function CalendarEventForm({
  date,
  event,
  onSuccess,
  onCancel,
}: {
  date: string;
  event?: CalendarEvent;
  onSuccess?: (event: CalendarEvent) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations("CalendarEventForm");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const queryClient = useQueryClient();

  const schema = useMemo(() => createCalendarEventSchema(tValidation), [tValidation]);

  const form = useForm<CalendarEventFormValues>({
    resolver: zodResolver(schema),
    defaultValues: event
      ? valuesFromEvent(event)
      : { title: "", description: "", date },
  });

  // A date only when the notes named one ("next Thursday"); otherwise the
  // day picked on the calendar stays.
  const ai = useAiDraft<CalendarEventFormValues, CalendarEventDraft>({
    form,
    kind: "calendar_event",
    toValues: (d) => ({ title: d.title, description: d.description, ...(d.date ? { date: d.date } : {}) }),
  });

  const mutation = useMutation({
    mutationFn: (values: CalendarEventFormValues) =>
      event
        ? apiFetch<{ calendar_event: CalendarEvent }>(
            `/api/calendar-events/${event.id}`,
            { method: "PUT", body: JSON.stringify(values) }
          )
        : apiFetch<{ calendar_event: CalendarEvent }>("/api/calendar-events", {
            method: "POST",
            body: JSON.stringify(values),
          }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success(event ? t("updatedToast") : t("createdToast"));
      if (!event) form.reset({ title: "", description: "", date });
      onSuccess?.(data.calendar_event);
    },
    onError: (err) => {
      const message = applyServerErrors(
        form,
        err,
        ["title", "description", "date"],
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="flex flex-col gap-4"
      >
        <AiDraftButton ai={ai} className="justify-end" hint={t("aiHint")} placeholder={t("aiPlaceholder")} />

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("titleLabel")}</FormLabel>
              <FormControl>
                <Input {...field} className={cn("h-10", ai.highlight("title"))} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("dateLabel")}</FormLabel>
              <FormControl>
                <Input {...field} type="date" className={cn("h-10", ai.highlight("date"))} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("descriptionLabel")}</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} className={ai.highlight("description")} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {event ? t("saveChanges") : t("addEvent")}
          </Button>

          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("cancel")}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
