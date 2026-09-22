import { z } from "zod";

// Validation messages come from the caller's `useTranslations("Validation")`
// so they follow the active locale — see lib/schemas.ts for the same
// convention on the other (non-feature-foldered) forms.
type Translate = (key: string) => string;

export function createCalendarEventSchema(t: Translate) {
  return z.object({
    title: z.string().min(1, t("calendarEventTitleRequired")).max(255),
    description: z.string(),
    date: z.string().min(1, t("calendarEventDateRequired")),
  });
}

export type CalendarEventFormValues = z.infer<
  ReturnType<typeof createCalendarEventSchema>
>;
