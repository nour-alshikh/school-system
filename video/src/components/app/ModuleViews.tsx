import { useCurrentFrame } from "remotion";
import { useLocale, useTranslations } from "next-intl";
import { Banknote, ChevronLeft, ChevronRight, Download, History, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useMoney } from "@/hooks/use-money";
import { popIn, progress } from "../../lib/motion";
import { attendance, calendarEvents, examResults, feeCharges, libraryResources, today } from "../../mock";
import { FieldFill } from "../FieldFill";
import { Press } from "../Ripple";
import { SuccessChip } from "../SuccessChip";
import { SelectBox } from "./SelectBox";

/*
 * One screen per module beat, each rebuilt from its page's markup with the
 * real ui components and strings, and driven by scene-local frames.
 */

const rowIn = (frame: number, at: number) => (frame < at ? { opacity: 0 } : popIn(frame, at));

// ── Attendance (features/attendance/attendance-page.tsx) ─────────────
type Status = "present" | "late" | "absent" | "excused";

export function AttendanceView({ taps, save }: { taps: number[]; save: number }) {
  const frame = useCurrentFrame();
  const t = useTranslations("AttendancePage");
  const labels: Record<Status, string> = { present: t("statusPresent"), absent: t("statusAbsent"), late: t("statusLate"), excused: t("statusExcused") };

  // Nudge the page up before Save so the button and its confirmation are in view.
  const lift = 48 * progress(frame, save - 14, 12);

  return (
    <main className="flex flex-col gap-4 p-6" style={{ transform: `translateY(${-lift}px)` }}>
      <h2 className="text-lg font-semibold">{t("heading")}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <SelectBox value="5a" label={attendance.classroom} className="w-48" />
        <Input readOnly type="date" value={attendance.date} className="h-10 w-40" />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("studentColumn")}</TableHead>
            <TableHead>{t("statusColumn")}</TableHead>
            <TableHead>{t("notesColumn")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attendance.students.map((name, row) => {
            const i = attendance.changes.findIndex(([r]) => r === row);
            const change = attendance.changes[i];
            const at = taps[i];
            const status: Status = change && at !== undefined && frame >= at + 2 ? change[1] : "present";
            return (
              <TableRow key={name}>
                <TableCell>{name}</TableCell>
                <TableCell>
                  {change && at !== undefined ? (
                    <Press at={at} radius={10} rippleColor="rgba(15,118,110,.15)">
                      <FieldFill value={labels[status]} at={at + 2} typeFrames={1}>
                        {() => <SelectBox value={status} label={labels[status]} className="w-36" />}
                      </FieldFill>
                    </Press>
                  ) : (
                    <SelectBox value={status} label={labels[status]} className="w-36" />
                  )}
                </TableCell>
                <TableCell>
                  <Input readOnly value="" placeholder={t("notesPlaceholder")} className="h-10 w-44" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="flex items-center gap-3">
        <Press at={save} radius={10}>
          <Button type="button">{t("saveAttendance")}</Button>
        </Press>
        <SuccessChip at={save + 8}>{t("savedToast", { count: attendance.students.length })}</SuccessChip>
      </div>
    </main>
  );
}

// ── Exam results (features/exams/exam-results-page.tsx) ──────────────
export function ExamResultsView({ rowsAt, gap }: { rowsAt: number; gap: number }) {
  const frame = useCurrentFrame();
  const t = useTranslations("ExamResultsPage");
  const locale = useLocale();
  return (
    <main className="flex flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold">{t("headingWithTitle", { title: examResults.title })}</h2>
      <p className="text-sm text-muted-foreground">{t("totalMarks", { total: examResults.total })}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("studentColumn")}</TableHead>
            <TableHead>{t("statusColumn")}</TableHead>
            <TableHead>{t("scoreColumn")}</TableHead>
            <TableHead>{t("submittedAtColumn")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {examResults.rows.map((row, i) => {
            const at = rowsAt + i * gap;
            const shown = Math.round(row.score * progress(frame, at, 14));
            return (
              <TableRow key={row.name} style={rowIn(frame, at)}>
                <TableCell>{row.name}</TableCell>
                <TableCell>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">{t("statusSubmitted")}</span>
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{`${shown}/${examResults.total}`}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(row.at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </main>
  );
}

// ── Fees (features/fee-charges/student-fees-section.tsx + fee-payment-form.tsx) ──
const badge = { unpaid: "bg-muted text-muted-foreground", partial: "bg-amber-500/10 text-amber-600", paid: "bg-emerald-500/10 text-emerald-600" } as const;

export function FeesView({ payButton, amount, record, updated }: { payButton: number; amount: number; record: number; updated: number }) {
  const frame = useCurrentFrame();
  const t = useTranslations("StudentFeesSection");
  const tPay = useTranslations("FeePaymentForm");
  const money = useMoney();
  const dialogOpen = frame >= payButton + 4 && frame < record + 6;
  const dialogIn = progress(frame, payButton + 4, 8);

  return (
    <div className="relative h-full">
      <main className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">{feeCharges.student}</h2>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("heading")}</h3>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm">
              <Printer className="size-4" />
              {t("print")}
            </Button>
            <Button type="button" size="sm">
              <Plus className="size-4" />
              {t("addCharge")}
            </Button>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("feeColumn")}</TableHead>
              <TableHead>{t("dueColumn")}</TableHead>
              <TableHead>{t("paidColumn")}</TableHead>
              <TableHead>{t("balanceColumn")}</TableHead>
              <TableHead>{t("statusColumn")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {feeCharges.rows.map((row, i) => {
              const paying = i === 0;
              const done = paying && frame >= updated;
              const paid = done ? row.paid + feeCharges.payment.amount : row.paid;
              const status = done ? "paid" : row.status;
              const cell = (value: string) =>
                paying ? (
                  <FieldFill value={value} at={updated} typeFrames={1} radiusClassName="rounded-md">
                    {(s) => <span className="block px-1">{s || value}</span>}
                  </FieldFill>
                ) : (
                  value
                );
              return (
                <TableRow key={row.fee}>
                  <TableCell>{row.fee}</TableCell>
                  <TableCell>{money(row.due)}</TableCell>
                  <TableCell>{cell(money(paid))}</TableCell>
                  <TableCell>{cell(money(row.due - paid))}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge[status]}`} style={done ? popIn(frame, updated) : undefined}>
                      {t(`status_${status}`)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="icon-sm">
                        <History className="size-4" />
                      </Button>
                      {status !== "paid" &&
                        (paying ? (
                          <Press at={payButton} radius={12} rippleColor="rgba(15,118,110,.2)">
                            <Button type="button" variant="outline" size="icon-sm">
                              <Banknote className="size-4" />
                            </Button>
                          </Press>
                        ) : (
                          <Button type="button" variant="outline" size="icon-sm">
                            <Banknote className="size-4" />
                          </Button>
                        ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div>
          <SuccessChip at={updated + 6}>{tPay("createdToast")}</SuccessChip>
        </div>
      </main>

      {dialogOpen && (
        <>
          <div className="absolute inset-0 bg-black/10" style={{ opacity: dialogIn }} />
          <div
            className="absolute top-1/2 left-1/2 grid w-[22rem] gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10"
            style={{ opacity: dialogIn, transform: `translate(-50%, -50%) scale(${0.95 + 0.05 * dialogIn})` }}
          >
            <p className="text-base leading-none font-medium">{t("recordPayment")}</p>
            <div className="grid gap-1.5">
              <Label>{tPay("amountLabel")}</Label>
              <FieldFill value={feeCharges.payment.amount.toFixed(2)} at={amount} typeFrames={8}>
                {(s) => <Input readOnly value={s} className="h-10" />}
              </FieldFill>
              <p className="text-xs text-muted-foreground">{tPay("balanceHint", { balance: money(feeCharges.payment.amount) })}</p>
            </div>
            <div className="grid gap-1.5">
              <Label>{tPay("methodLabel")}</Label>
              <SelectBox value="cash" label={tPay("methodCash")} className="w-full" />
            </div>
            <div className="flex gap-2">
              <Press at={record} radius={10}>
                <Button type="button">{tPay("recordPayment")}</Button>
              </Press>
              <Button type="button" variant="outline">
                {tPay("cancel")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Calendar (features/calendar/calendar.tsx) ────────────────────────
function monthGrid(year: number, month: number) {
  const start = new Date(year, month, 1 - new Date(year, month, 1).getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function CalendarView({ eventsAt, gap }: { eventsAt: number; gap: number }) {
  const frame = useCurrentFrame();
  const locale = useLocale();
  const t = useTranslations("CalendarPage");
  const intl = locale === "ar" ? "ar-EG" : "en-US";
  const [y, m] = today.split("-").map(Number) as [number, number];
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(intl, { weekday: "short" }).format(new Date(2023, 0, i + 1)));
  const label = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));

  return (
    <div className="p-6">
      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{label}</h3>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="icon-sm" aria-label={t("previousMonth")}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button type="button" variant="outline" size="icon-sm" aria-label={t("nextMonth")}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border text-center text-xs">
          {weekdays.map((w) => (
            <div key={w} className="bg-muted py-1 font-medium text-muted-foreground">
              {w}
            </div>
          ))}
          {monthGrid(y, m - 1).map((date) => {
            const k = key(date);
            const events = calendarEvents.map((e, i) => ({ ...e, at: eventsAt + i * gap })).filter((e) => e.date === k);
            return (
              <div key={k} className={cn("flex min-h-16 flex-col items-start gap-1 bg-background p-1 text-start", date.getMonth() !== m - 1 && "text-muted-foreground/50")}>
                <span className={cn("flex size-5 items-center justify-center rounded-full text-xs", k === today && "bg-primary text-primary-foreground")}>{date.getDate()}</span>
                {events.map(
                  (e) =>
                    frame >= e.at && (
                      <span key={e.title} className="w-full truncate rounded bg-primary/10 px-1 text-[10px] text-primary" style={{ ...popIn(frame, e.at), transformOrigin: "left center" }}>
                        {e.title}
                      </span>
                    ),
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ── Library (features/library-resources/library-resources-page.tsx) ──
export function LibraryView({ filter, rowsAt, gap, shared }: { filter: number; rowsAt: number; gap: number; shared: number }) {
  const frame = useCurrentFrame();
  const t = useTranslations("LibraryResourcesPage");
  const filtered = frame >= filter + 2;
  // The last resource is the one being shared to the grade in this beat.
  const rows = libraryResources.map((r, i) => ({ ...r, at: i === libraryResources.length - 1 ? shared : rowsAt + i * gap }));

  return (
    <main className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("heading")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Press at={shared - 10} radius={12}>
          <Button type="button" size="sm">
            <Plus className="size-4" />
            {t("newResource")}
          </Button>
        </Press>
      </div>
      <div className="flex flex-wrap gap-3">
        <Press at={filter} radius={10} rippleColor="rgba(15,118,110,.15)">
          <FieldFill value="Grade 8" at={filter + 2} typeFrames={1}>
            {() => <SelectBox value={filtered ? "8" : "all"} label={filtered ? "Grade 8" : t("allGrades")} className="w-48" />}
          </FieldFill>
        </Press>
        <SelectBox value="all" label={t("allSubjects")} className="w-48" />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("titleColumn")}</TableHead>
            <TableHead>{t("gradeColumn")}</TableHead>
            <TableHead>{t("subjectsColumn")}</TableHead>
            <TableHead>{t("uploaderColumn")}</TableHead>
            <TableHead className="text-end">{t("actionsColumn")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.title} style={rowIn(frame, r.at)} className={cn(r.at === shared && frame >= shared && frame < shared + 45 && "bg-brand-accent/5")}>
              <TableCell>{r.title}</TableCell>
              <TableCell>{r.grade}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {r.subjects.map((s) => (
                    <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {s}
                    </span>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{r.uploader}</TableCell>
              <TableCell className="text-end">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon">
                    <Download className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}
