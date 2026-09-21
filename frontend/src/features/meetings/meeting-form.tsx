"use client";

import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { MultiSelect } from "@/components/multi-select";
import {
  createMeetingSchema,
  defaultMeetingValues,
  type MeetingFormValues,
} from "./schema";
import type { Meeting, MeetingClassroom } from "./types";

// ISO datetime -> the value <input type="datetime-local"> expects — see the
// matching helper in exams/exam-form.tsx.
function toApiPayload(values: MeetingFormValues) {
  return {
    title: values.title,
    description: values.description || null,
    classroom_ids: values.classroom_ids.map(Number),
    start_time: new Date(values.start_time).toISOString(),
    duration_minutes: Number(values.duration_minutes),
  };
}

export function MeetingForm({
  onSuccess,
}: {
  onSuccess?: (meeting: Meeting) => void;
}) {
  const t = useTranslations("MeetingFormPage");
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");
  const queryClient = useQueryClient();

  const schema = createMeetingSchema(tValidation);
  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultMeetingValues,
  });

  // Admin gets every classroom, a teacher only the ones they hold a subject
  // slot in — same split as ExamController::teachingAssignments(), just a
  // plain classroom list since a meeting isn't tied to one subject.
  const { data: classrooms = [] } = useQuery({
    queryKey: ["meeting-classrooms"],
    queryFn: () =>
      apiFetch<{ classrooms: MeetingClassroom[] }>("/api/meetings/classrooms").then(
        (d) => d.classrooms
      ),
  });

  const mutation = useMutation({
    mutationFn: (values: MeetingFormValues) =>
      apiFetch<{ meeting: Meeting }>("/api/meetings", {
        method: "POST",
        body: JSON.stringify(toApiPayload(values)),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meetings"], exact: false });
      toast.success(t("createSuccess"));
      onSuccess?.(data.meeting);
    },
    onError: (err) => {
      const message = applyServerErrors(
        form,
        err,
        ["title", "description", "classroom_ids", "start_time", "duration_minutes"],
        tErrors("somethingWentWrong")
      );
      if (message) toast.error(message);
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="flex flex-col gap-6"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("titleLabel")}</FormLabel>
              <FormControl>
                <Input {...field} className="h-10" />
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
                <Textarea {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="classroom_ids"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("classroomsLabel")}</FormLabel>
              <MultiSelect
                options={classrooms.map((c) => ({ value: String(c.id), label: c.name }))}
                value={field.value}
                onValueChange={field.onChange}
                placeholder={t("classroomsPlaceholder")}
              />
              <FormMessage />
              {classrooms.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("noClassrooms")}</p>
              )}
            </FormItem>
          )}
        />

        <div className="flex flex-wrap gap-4">
          <FormField
            control={form.control}
            name="start_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("startTimeLabel")}</FormLabel>
                <FormControl>
                  <Input type="datetime-local" className="h-10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="duration_minutes"
            render={({ field }) => (
              <FormItem className="w-40">
                <FormLabel>{t("durationLabel")}</FormLabel>
                <FormControl>
                  <Input type="number" min={1} className="h-10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {t("createMeeting")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
