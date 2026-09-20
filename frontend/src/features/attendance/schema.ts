import { z } from "zod";
import type { AttendanceStatus } from "./types";

// Validation messages come from the caller's `useTranslations("Validation")`
// so they follow the active locale — see lib/schemas.ts for the same
// convention on the other (non-feature-foldered) forms.
type Translate = (key: string) => string;

export const attendanceStatusOptions = [
  "present",
  "absent",
  "late",
  "excused",
] as const satisfies readonly AttendanceStatus[];

export function createAttendanceRowSchema() {
  return z.object({
    student_id: z.number(),
    status: z.enum(attendanceStatusOptions),
    notes: z.string().max(1000).optional().or(z.literal("")),
  });
}

export function createAttendanceSchema(t: Translate) {
  return z.object({
    rows: z.array(createAttendanceRowSchema()).min(1, t("attendanceRowsRequired")),
  });
}

export type AttendanceRowValues = z.infer<ReturnType<typeof createAttendanceRowSchema>>;
export type AttendanceFormValues = z.infer<ReturnType<typeof createAttendanceSchema>>;
