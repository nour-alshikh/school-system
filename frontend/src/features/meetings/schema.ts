import { z } from "zod";

// Validation messages come from the caller's `useTranslations("Validation")`
// so they follow the active locale — same convention as exams/schema.ts.
type Translate = (key: string) => string;

// Numbers stay strings in form state (converted with Number() at submit,
// see toApiPayload in meeting-form.tsx) — same convention as
// exams/schema.ts's positiveIntStringSchema.
function positiveIntStringSchema(t: Translate, message: string) {
  return z.string().refine((value) => /^\d+$/.test(value) && Number(value) >= 1, message);
}

export function createMeetingSchema(t: Translate) {
  return z.object({
    title: z.string().min(1, t("titleRequired")).max(255),
    description: z.string().max(5000).optional().or(z.literal("")),
    classroom_ids: z.array(z.string()).min(1, t("meetingClassroomsRequired")),
    start_time: z.string().min(1, t("meetingStartTimeRequired")),
    duration_minutes: positiveIntStringSchema(t, t("durationMin")),
  });
}

export type MeetingFormValues = z.infer<ReturnType<typeof createMeetingSchema>>;

export const defaultMeetingValues: MeetingFormValues = {
  title: "",
  description: "",
  classroom_ids: [],
  start_time: "",
  duration_minutes: "30",
};
