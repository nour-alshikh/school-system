/**
 * Proposals the assistant hands to a page instead of saving from the chat
 * (docs/ai-assistant-plan.md, phase 6): the exam builder gets a "Draft with
 * AI" request, the attendance page a set of marks to review. Kept in
 * sessionStorage for one read, so a reload or another tab doesn't refill.
 */
import type { AttendanceStatus } from "@/features/attendance/types";

const EXAM_KEY = "assistant:exam-draft";
const ATTENDANCE_KEY = "assistant:attendance";

export interface ExamHandoff {
  title: string | null;
  request: string;
}

export interface AttendanceHandoff {
  classroom_id: number;
  date: string;
  default_status: AttendanceStatus;
  /** student_id → status, for the students named. */
  marks: Record<number, AttendanceStatus>;
}

function put(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the page simply opens empty.
  }
}

function peek<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function forget(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

export const examHandoff = {
  put: (value: ExamHandoff) => put(EXAM_KEY, value),
  peek: () => peek<ExamHandoff>(EXAM_KEY),
  forget: () => forget(EXAM_KEY),
};

export const attendanceHandoff = {
  put: (value: AttendanceHandoff) => put(ATTENDANCE_KEY, value),
  peek: () => peek<AttendanceHandoff>(ATTENDANCE_KEY),
  forget: () => forget(ATTENDANCE_KEY),
};
