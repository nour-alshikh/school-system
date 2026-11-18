"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CalendarPlus, Check, CheckSquare, ClipboardList, Layers, Loader2, Video, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import type { AssistantActionType } from "@/types/generated";
import type { AttendanceStatus } from "@/features/attendance/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { attendanceHandoff, examHandoff } from "./handoff";

type Status = "done" | "dismissed";

const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];

const ICONS = {
  create_event: CalendarPlus,
  schedule_meeting: Video,
  draft_exam: ClipboardList,
  mark_attendance: CheckSquare,
  set_up_structure: Layers,
} as const;

interface EventFields {
  title: string;
  date: string;
  description: string | null;
}

interface MeetingFields {
  title: string;
  description: string | null;
  classroom_ids: number[];
  classrooms: string[];
  start_time: string;
  duration_minutes: number;
}

interface ExamFields {
  request: string;
  title: string | null;
}

interface AttendanceFields {
  classroom_id: number;
  classroom: string;
  date: string;
  default_status: AttendanceStatus;
  students: number;
  exceptions: { student_id: number; name: string; status: AttendanceStatus }[];
}

interface NamePair {
  name_en: string;
  name_ar: string;
}

/** SetUpStructure's card: the additions to send back, and the preview of what's new (StructureAdditions::plan). */
interface StructureFields {
  request: string;
  additions: Record<string, unknown>;
  preview: {
    stages: (NamePair & { id: number | null; grades: (NamePair & { id: number | null; classrooms: string[] })[] })[];
    subjects: (NamePair & { id: number | null; stages: NamePair[] })[];
    counts: { stages: number; grades: number; classrooms: number; subjects: number; subject_stages: number };
  };
}

/**
 * What the assistant proposes doing (docs/ai-assistant-plan.md, phase 6):
 * nothing has happened yet. An event or meeting is saved by Confirm through
 * its normal endpoint, after any edits here; an exam or attendance opens
 * its normal page pre-filled, to finish and save there. `onStatus` records
 * the outcome so the card isn't offered again.
 */
export function AssistantActionCard({
  action,
  onStatus,
  onNavigate,
}: {
  action: AssistantActionType;
  onStatus: (status: Status) => void;
  /** Opens a page (the panel closes itself on phones). */
  onNavigate: (href: string) => void;
}) {
  const t = useTranslations("Assistant.actions");
  const Icon = ICONS[action.name];

  if (action.status !== "proposed") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {action.status === "done" ? <Check className="size-3.5" /> : <X className="size-3.5" />}
        {t(`title_${action.name}`)} · {action.status === "done" ? t("done") : t("dismissed")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-brand-accent/40 bg-brand-accent/5 p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-brand-accent-strong dark:text-brand-accent" />
        {t(`title_${action.name}`)}
      </p>

      {action.warnings.length > 0 && <Warnings codes={action.warnings} />}

      {action.name === "create_event" && (
        <EventForm fields={action.fields as unknown as EventFields} onStatus={onStatus} />
      )}
      {action.name === "schedule_meeting" && (
        <MeetingForm fields={action.fields as unknown as MeetingFields} onStatus={onStatus} />
      )}
      {action.name === "draft_exam" && (
        <ExamForm fields={action.fields as unknown as ExamFields} onStatus={onStatus} onNavigate={onNavigate} />
      )}
      {action.name === "mark_attendance" && (
        <AttendanceForm fields={action.fields as unknown as AttendanceFields} onStatus={onStatus} onNavigate={onNavigate} />
      )}
      {action.name === "set_up_structure" && (
        <StructureForm fields={action.fields as unknown as StructureFields} onStatus={onStatus} />
      )}
    </div>
  );
}

function Warnings({ codes }: { codes: string[] }) {
  const t = useTranslations("Assistant.actions.warnings");

  return (
    <ul className="flex flex-col gap-1 text-xs text-amber-800 dark:text-amber-300">
      {codes.map((code) => {
        const [key, ...rest] = code.split(":");
        const name = rest.join(":");
        const known = ["past_date", "zoom_not_connected", "classroom_not_found", "classroom_ambiguous", "student_not_found", "student_ambiguous", "structure_existing_skipped"];
        if (!known.includes(key)) return null;
        return (
          <li key={code} className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {t(key, { name })}
          </li>
        );
      })}
    </ul>
  );
}

function Actions({
  confirmLabel,
  pending,
  disabled,
  onConfirm,
  onDismiss,
}: {
  confirmLabel: string;
  pending?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("Assistant.actions");

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onDismiss}>
        {t("dismiss")}
      </Button>
      <Button type="button" size="sm" disabled={pending || disabled} onClick={onConfirm}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        {confirmLabel}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function useSave(onStatus: (status: Status) => void, invalidate: string | string[]) {
  const t = useTranslations("Assistant.actions");
  const tErrors = useTranslations("Errors");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ url, body }: { url: string; body: unknown }) =>
      apiFetch(url, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      for (const key of Array.isArray(invalidate) ? invalidate : [invalidate]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success(t("saved"));
      onStatus("done");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : tErrors("somethingWentWrong")),
  });
}

function EventForm({ fields, onStatus }: { fields: EventFields; onStatus: (s: Status) => void }) {
  const t = useTranslations("Assistant.actions");
  const [title, setTitle] = useState(fields.title);
  const [date, setDate] = useState(fields.date);
  const [description, setDescription] = useState(fields.description ?? "");
  const save = useSave(onStatus, "calendar-events");

  return (
    <>
      <Field label={t("title")}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} className="h-9 bg-background" />
      </Field>
      <Field label={t("date")}>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 bg-background" />
      </Field>
      <Field label={t("description")}>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="bg-background" />
      </Field>
      <Actions
        confirmLabel={t("confirm_create_event")}
        pending={save.isPending}
        disabled={!title.trim() || !date}
        onConfirm={() => save.mutate({ url: "/api/calendar-events", body: { title: title.trim(), date, description: description.trim() || null } })}
        onDismiss={() => onStatus("dismissed")}
      />
    </>
  );
}

function MeetingForm({ fields, onStatus }: { fields: MeetingFields; onStatus: (s: Status) => void }) {
  const t = useTranslations("Assistant.actions");
  const [title, setTitle] = useState(fields.title);
  const [start, setStart] = useState(fields.start_time);
  const [duration, setDuration] = useState(String(fields.duration_minutes));
  const save = useSave(onStatus, "meetings");

  return (
    <>
      <Field label={t("title")}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} className="h-9 bg-background" />
      </Field>
      <p className="text-xs text-muted-foreground">
        {t("classrooms")}: <span className="text-foreground">{fields.classrooms.join("، ")}</span>
      </p>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <Field label={t("start")}>
          <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 bg-background" />
        </Field>
        <Field label={t("minutes")}>
          <Input type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(e.target.value)} className="h-9 bg-background" />
        </Field>
      </div>
      <Actions
        confirmLabel={t("confirm_schedule_meeting")}
        pending={save.isPending}
        disabled={!title.trim() || !start || !Number(duration)}
        onConfirm={() =>
          save.mutate({
            url: "/api/meetings",
            body: {
              title: title.trim(),
              description: fields.description,
              classroom_ids: fields.classroom_ids,
              // As the meeting form sends it: the browser's local time, as ISO.
              start_time: new Date(start).toISOString(),
              duration_minutes: Number(duration),
            },
          })
        }
        onDismiss={() => onStatus("dismissed")}
      />
    </>
  );
}

function ExamForm({
  fields,
  onStatus,
  onNavigate,
}: {
  fields: ExamFields;
  onStatus: (s: Status) => void;
  onNavigate: (href: string) => void;
}) {
  const t = useTranslations("Assistant.actions");
  const [request, setRequest] = useState(fields.request);

  return (
    <>
      {fields.title && (
        <p className="text-xs text-muted-foreground">
          {t("title")}: <span className="text-foreground">{fields.title}</span>
        </p>
      )}
      <Field label={t("request")}>
        <Textarea rows={3} value={request} onChange={(e) => setRequest(e.target.value)} maxLength={2000} className="bg-background" />
      </Field>
      <p className="text-xs text-muted-foreground">{t("examHint")}</p>
      <Actions
        confirmLabel={t("confirm_draft_exam")}
        disabled={!request.trim()}
        onConfirm={() => {
          examHandoff.put({ title: fields.title, request: request.trim() });
          onStatus("done");
          onNavigate("/exams/new");
        }}
        onDismiss={() => onStatus("dismissed")}
      />
    </>
  );
}

function AttendanceForm({
  fields,
  onStatus,
  onNavigate,
}: {
  fields: AttendanceFields;
  onStatus: (s: Status) => void;
  onNavigate: (href: string) => void;
}) {
  const t = useTranslations("Assistant.actions");
  const tStatus = useTranslations("AttendancePage");
  const [marks, setMarks] = useState(() => Object.fromEntries(fields.exceptions.map((e) => [e.student_id, e.status])));

  const label = (status: AttendanceStatus) => tStatus(`status${status[0].toUpperCase()}${status.slice(1)}`);

  return (
    <>
      <p className="text-xs text-muted-foreground">
        <span className="text-foreground">{fields.classroom}</span> · <span dir="ltr">{fields.date}</span>
      </p>
      {fields.exceptions.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {fields.exceptions.map((row) => (
            <li key={row.student_id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{row.name}</span>
              <select
                value={marks[row.student_id]}
                onChange={(e) => setMarks((m) => ({ ...m, [row.student_id]: e.target.value as AttendanceStatus }))}
                className="h-8 rounded-md border bg-background px-2 text-sm"
                aria-label={row.name}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {label(status)}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        {t("everyoneElse", { status: label(fields.default_status), count: fields.students - fields.exceptions.length })}
      </p>
      <Actions
        confirmLabel={t("confirm_mark_attendance")}
        onConfirm={() => {
          attendanceHandoff.put({
            classroom_id: fields.classroom_id,
            date: fields.date,
            default_status: fields.default_status,
            marks,
          });
          onStatus("done");
          onNavigate(`/attendance?classroom=${fields.classroom_id}&date=${fields.date}&from=assistant`);
        }}
        onDismiss={() => onStatus("dismissed")}
      />
    </>
  );
}

function StructureForm({ fields, onStatus }: { fields: StructureFields; onStatus: (s: Status) => void }) {
  const t = useTranslations("Assistant.actions");
  const locale = useLocale();
  const save = useSave(onStatus, ["stages", "grades", "classrooms", "subjects", "admin-onboarding"]);
  const name = (item: NamePair) => (locale === "ar" ? item.name_ar : item.name_en);
  const { stages, subjects, counts } = fields.preview;

  return (
    <>
      <p className="text-xs text-muted-foreground">
        {t("structureSummary", {
          stages: counts.stages,
          grades: counts.grades,
          classrooms: counts.classrooms,
          subjects: counts.subjects + counts.subject_stages,
        })}
      </p>
      <ul className="flex flex-col gap-2 text-sm">
        {stages.map((stage) => (
          <li key={`${stage.id ?? "new"}-${stage.name_en}`} className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 font-medium">
              {name(stage)}
              <New show={stage.id === null} />
            </span>
            <ul className="flex flex-col gap-0.5 border-s ps-3">
              {stage.grades.map((grade) => (
                <li key={`${grade.id ?? "new"}-${grade.name_en}`} className="text-xs">
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    {name(grade)}
                    <New show={grade.id === null} />
                  </span>
                  {grade.classrooms.length > 0 && (
                    <span className="text-muted-foreground" dir="auto">
                      {" "}
                      · {t("structureClassrooms", { names: grade.classrooms.join(locale === "ar" ? "، " : ", ") })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {subjects.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">{t("structureSubjects")}</p>
          <ul className="flex flex-col gap-0.5 text-xs">
            {subjects.map((subject) => (
              <li key={subject.name_en} className="flex flex-wrap items-center gap-1.5">
                <span className="text-foreground">{name(subject)}</span>
                <New show={subject.id === null} />
                {subject.id !== null && (
                  <span className="text-muted-foreground">{t("structureAlsoIn", { stages: subject.stages.map(name).join(locale === "ar" ? "، " : ", ") })}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("structureHint")}</p>
      <Actions
        confirmLabel={t("confirm_set_up_structure")}
        pending={save.isPending}
        onConfirm={() => save.mutate({ url: "/api/structure/additions", body: { additions: fields.additions } })}
        onDismiss={() => onStatus("dismissed")}
      />
    </>
  );
}

function New({ show }: { show: boolean }) {
  const t = useTranslations("Assistant.actions");
  if (!show) return null;
  return (
    <span className="rounded bg-brand-accent/15 px-1 py-px text-[10px] font-medium uppercase tracking-wide text-brand-accent-strong dark:text-brand-accent">
      {t("structureNew")}
    </span>
  );
}
