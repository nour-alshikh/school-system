import { useLocale, useTranslations } from "next-intl";
import { CheckSquare, ClipboardList, ClipboardPlus, DoorOpen, GraduationCap, Presentation, Trophy, UserPlus, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/features/admin-dashboard/kpi-card";
import { Panel } from "@/features/admin-dashboard/charts";
import { formatNumber, formatPercent } from "@/features/admin-dashboard/utils";
import { RateRing, headerBadgeClass } from "@/features/role-dashboard/shared";
import { useMoney } from "@/hooks/use-money";
import { dashboards } from "../../mock";
import { ChartsReady } from "./ChartsReady";
import { DashboardHeader } from "./DashboardHeader";

/*
 * The top of each role's dashboard: its header and KPI row, built from the
 * app's real KpiCard / Panel / RateRing with mock data. Only the part that
 * reads at video size is shown (the charts and lists further down are cropped).
 * Grids use fixed columns: Tailwind breakpoints would follow the video's
 * viewport, not the card.
 */

const first = (name: string) => name.split(" ")[0] ?? name;

export function AdminDashboardView({ columns = 2 }: { columns?: 1 | 2 }) {
  const t = useTranslations("AdminDashboardPage");
  const locale = useLocale();
  const money = useMoney();
  const d = dashboards.admin;

  return (
    <ChartsReady>
    <main className="flex flex-col gap-6 p-6">
      <DashboardHeader
        title={t("greetingMorning", { name: "Demo Admin" })}
        badges={<Badge className={headerBadgeClass}>{t("academicYearLabel", { year: d.academicYear })}</Badge>}
        actions={
          columns === 2 ? (
            <>
              <Button size="sm">
                <UserPlus className="size-4" />
                {t("actionAddStudent")}
              </Button>
              <Button size="sm" variant="outline">
                <CheckSquare className="size-4" />
                {t("actionAttendance")}
              </Button>
            </>
          ) : undefined
        }
      />
      <section className={columns === 2 ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
        <KpiCard icon={GraduationCap} title={t("studentsHeading")} value={formatNumber(d.students, locale)} spark={d.enrollments} subtext={t("newThisMonth", { count: d.newThisMonth })} />
        <KpiCard
          tone="amber"
          icon={Presentation}
          title={t("teachersHeading")}
          value={formatNumber(d.teachers, locale)}
          subtext={t("teachersSubtext", { classrooms: d.classrooms, parents: d.parents })}
        />
        <KpiCard
          icon={CheckSquare}
          title={t("attendanceTodayHeading")}
          value={formatPercent(d.attendanceToday, locale)}
          spark={d.attendanceSpark}
          change={{ value: d.attendanceChange, label: t("points", { value: formatNumber(d.attendanceChange, locale, 1) }), caption: t("vsWeekAverage") }}
          subtext={t("presentOfMarked", { present: d.present, marked: d.marked })}
        />
        <KpiCard
          tone="amber"
          icon={Wallet}
          title={t("feesThisMonthHeading")}
          value={money(d.feesCollected)}
          spark={d.feesSpark}
          change={{ value: d.feesChange, label: formatPercent(d.feesChange, locale), caption: t("vsLastMonth") }}
          subtext={t("feesOutstandingLabel", { amount: money(d.feesOutstanding) })}
        />
      </section>
    </main>
    </ChartsReady>
  );
}

export function TeacherDashboardView() {
  const t = useTranslations("RoleDashboards");
  const locale = useLocale();
  const d = dashboards.teacher;
  return (
    <ChartsReady>
    <main className="flex flex-col gap-6 p-6">
      <DashboardHeader
        title={t("greetingMorning", { name: first(d.name) })}
        actions={
          <>
            <Button size="sm">
              <CheckSquare className="size-4" />
              {t("takeAttendance")}
            </Button>
            <Button size="sm" variant="outline">
              <ClipboardPlus className="size-4" />
              {t("newExam")}
            </Button>
          </>
        }
      />
      <section className="grid grid-cols-2 gap-4">
        <KpiCard icon={DoorOpen} title={t("kpiClassrooms")} value={formatNumber(d.classrooms, locale)} subtext={t("kpiSubjects", { count: 2 })} />
        <KpiCard tone="amber" icon={Users} title={t("kpiStudents")} value={formatNumber(d.students, locale)} />
        <KpiCard
          icon={CheckSquare}
          title={t("kpiMarkedToday")}
          value={t("ofTotal", { value: formatNumber(d.marked, locale), total: formatNumber(d.classrooms, locale) })}
          subtext={t("classroomsMarked")}
        />
        <KpiCard tone="amber" icon={ClipboardList} title={t("kpiAverageScore")} value={formatPercent(d.average, locale, 0)} spark={d.scoreSpark} subtext={t("lastExams", { count: 5 })} />
      </section>
    </main>
    </ChartsReady>
  );
}

export function StudentDashboardView() {
  const t = useTranslations("RoleDashboards");
  const locale = useLocale();
  const money = useMoney();
  const d = dashboards.student;
  return (
    <ChartsReady>
    <main className="flex flex-col gap-6 p-6">
      <DashboardHeader title={t("hi", { name: first(d.name) })} />
      <section className="grid grid-cols-2 gap-4">
        <KpiCard
          icon={CheckSquare}
          title={t("kpiAttendance")}
          value={formatPercent(d.attendance, locale, 0)}
          subtext={t("daysPresent", { present: formatNumber(d.present, locale), total: formatNumber(d.total, locale) })}
        />
        <KpiCard tone="amber" icon={ClipboardList} title={t("kpiExamsToTake")} value={formatNumber(d.examsToTake, locale)} subtext={t("nextCloses", { when: new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(1, "day") })} />
        <KpiCard icon={Trophy} title={t("kpiAverageScore")} value={formatPercent(d.average, locale, 0)} spark={d.scoreSpark} subtext={t("lastExams", { count: 5 })} />
        <KpiCard tone="amber" icon={Wallet} title={t("kpiFeesOutstanding")} value={money(d.outstanding)} subtext={t("ofTotalDue", { total: money(d.totalDue) })} />
      </section>
    </main>
    </ChartsReady>
  );
}

export function ParentDashboardView() {
  const t = useTranslations("RoleDashboards");
  const money = useMoney();
  const d = dashboards.parent;
  return (
    <ChartsReady>
    <main className="flex flex-col gap-6 p-6">
      <DashboardHeader
        title={t("greetingMorning", { name: first(d.name) })}
        badges={<Badge className={headerBadgeClass}>{`${d.child} · ${d.childGrade}`}</Badge>}
      />
      <section className="grid grid-cols-2 gap-4">
        <Panel title={t("kpiAttendance")} description={t("thisYear")}>
          <div className="flex items-center justify-center py-1">
            <RateRing rate={d.attendance} label={t("present")} size={120} />
          </div>
        </Panel>
        <Panel title={t("fees")} description={t("paidOfTotal", { paid: money(d.paid), total: money(d.totalDue) })}>
          <div className="flex flex-col gap-3 pt-2">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand-accent" style={{ width: `${(d.paid / d.totalDue) * 100}%` }} />
            </div>
            <Button size="sm" variant="outline" className="w-fit">
              <Wallet className="size-4" />
              {t("viewFees")}
            </Button>
          </div>
        </Panel>
      </section>
    </main>
    </ChartsReady>
  );
}
