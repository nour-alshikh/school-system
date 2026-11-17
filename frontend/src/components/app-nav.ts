"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Award,
  BookOpen,
  Building2,
  CalendarRange,
  CheckSquare,
  ClipboardList,
  DollarSign,
  DoorOpen,
  Gauge,
  GraduationCap,
  History,
  Layers,
  LayoutDashboard,
  Library,
  Link2,
  List,
  Megaphone,
  Plus,
  ScrollText,
  Settings,
  ShieldCheck,
  TrendingUp,
  User as UserIcon,
  UserCog,
  UserPlus,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { isPlatformSession } from "@/lib/platform";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** A collapsible group (index page + its create/history pages). */
  children?: NavItem[];
  /** Remembers whether the group is open. */
  storageKey?: string;
}

export interface NavSection {
  key: string;
  label: string;
  items: NavItem[];
}

/** True when `pathname` is `href` or a page under it. */
function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function flatten(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => (item.children ? flatten(item.children) : [item]));
}

/**
 * The app's navigation, filtered to what this user may open. Shared by the
 * sidebar, the mobile drawer and the ⌘K search, so all three always agree.
 * Each link uses the same gate as the API routes behind its page, so nobody
 * sees a link to a page that would answer 403.
 */
export function useNavSections(): { sections: NavSection[]; activeHref: string | null } {
  const t = useTranslations("Nav");
  const { user, can, hasRole } = useAuth();
  const pathname = usePathname();

  const sections = useMemo(() => {
    if (!user) return [];

    // Modules outside the school's plan are hidden (the API refuses them
    // too). No plan info (no current school) hides nothing.
    const hasFeature = (feature: string) => !user.plan_features || user.plan_features.includes(feature);
    const when = (condition: boolean, ...items: NavItem[]): NavItem[] => (condition ? items : []);

    const isTeacher = hasRole("teacher");
    const isStudent = hasRole("student");
    const isParent = hasRole("parent");

    const all: NavSection[] = [
      {
        key: "overview",
        label: t("sectionOverview"),
        items: [{ href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard }],
      },
      {
        key: "myPortal",
        label: t("sectionMyPortal"),
        items: [
          ...when(isParent, { href: "/parent", label: t("myInfo"), icon: UserIcon }),
          ...when(isParent, { href: "/parent-attendance", label: t("myAttendance"), icon: CheckSquare }),
          ...when(isParent && hasFeature("fees"), { href: "/parent-fees", label: t("myFees"), icon: DollarSign }),
          ...when(isParent && hasFeature("library"), { href: "/parent-library", label: t("library"), icon: Library }),
          ...when(isStudent && hasFeature("exams"), { href: "/my-exams", label: t("myExams"), icon: ClipboardList }),
          ...when(isStudent, { href: "/my-attendance", label: t("myAttendance"), icon: CheckSquare }),
          ...when(isStudent, { href: "/my-subjects", label: t("mySubjects"), icon: BookOpen }),
          ...when(isStudent && hasFeature("fees"), { href: "/my-fees", label: t("myFees"), icon: DollarSign }),
          ...when(isStudent && hasFeature("library"), { href: "/my-library", label: t("library"), icon: Library }),
          ...when(isTeacher, { href: "/my-classrooms", label: t("myClassrooms"), icon: DoorOpen }),
        ],
      },
      {
        key: "academics",
        label: t("sectionAcademics"),
        items: [
          // The academic structure: same gate as its API routes.
          ...when(
            can("manage-academics") || can("manage-students"),
            { href: "/stages", label: t("stages"), icon: GraduationCap },
            { href: "/grades", label: t("grades"), icon: Layers },
            { href: "/classrooms", label: t("classrooms"), icon: DoorOpen },
            { href: "/academic-years", label: t("academicYears"), icon: CalendarRange },
            { href: "/subjects", label: t("subjects"), icon: BookOpen }
          ),
          ...when(can("manage-attendance") || isTeacher, {
            href: "/attendance",
            label: t("attendance"),
            icon: CheckSquare,
            storageKey: "sidebar-attendance-group-open",
            children: [
              { href: "/attendance", label: t("takeAttendance"), icon: CheckSquare },
              { href: "/attendance/history", label: t("attendanceHistory"), icon: History },
            ],
          }),
          ...when((can("manage-exams") || isTeacher) && hasFeature("exams"), {
            href: "/exams",
            label: t("exams"),
            icon: ClipboardList,
            storageKey: "sidebar-exams-group-open",
            children: [
              { href: "/exams", label: t("allExams"), icon: List },
              { href: "/exams/new", label: t("createExam"), icon: Plus },
            ],
          }),
          ...when((can("manage-academics") || isTeacher) && hasFeature("library"), {
            href: "/library",
            label: t("library"),
            icon: Library,
          }),
        ],
      },
      {
        key: "people",
        label: t("sectionPeople"),
        items: [
          ...when(can("manage-students"), {
            href: "/students",
            label: t("students"),
            icon: UserPlus,
            storageKey: "sidebar-students-group-open",
            children: [
              { href: "/students", label: t("allStudents"), icon: List },
              { href: "/students/new", label: t("addStudent"), icon: Plus },
              { href: "/promotions", label: t("promoteStudents"), icon: TrendingUp },
              { href: "/promotions/history", label: t("promotionHistory"), icon: History },
              { href: "/graduations", label: t("graduateStudents"), icon: Award },
              { href: "/graduations/history", label: t("graduationHistory"), icon: History },
            ],
          }),
          ...when(can("manage-teachers"), {
            href: "/teachers",
            label: t("teachers"),
            icon: UserCog,
            storageKey: "sidebar-teachers-group-open",
            children: [
              { href: "/teachers", label: t("allTeachers"), icon: List },
              { href: "/teacher-subjects", label: t("teacherSubjects"), icon: Link2 },
            ],
          }),
          ...when(can("manage-users"), { href: "/admin/users", label: t("manageUsers"), icon: Users }),
        ],
      },
      {
        key: "finance",
        label: t("sectionFinance"),
        items: when(can("manage-fees") && hasFeature("fees"), { href: "/fees", label: t("fees"), icon: DollarSign }),
      },
      {
        key: "communication",
        label: t("sectionCommunication"),
        items: [
          ...when((can("manage-meetings") || isTeacher) && hasFeature("meetings"), {
            href: "/meetings",
            label: t("meetings"),
            icon: Video,
          }),
          ...when(isStudent && hasFeature("meetings"), { href: "/my-meetings", label: t("myMeetings"), icon: Video }),
        ],
      },
      {
        key: "administration",
        label: t("sectionAdministration"),
        items: [
          ...when(can("manage-settings"), { href: "/admin/settings", label: t("settings"), icon: Settings }),
          ...when(hasRole("admin"), {
            href: "/admin/system-admin-activity",
            label: t("systemAdminActivity"),
            icon: ShieldCheck,
          }),
        ],
      },
      {
        // A system admin's platform session (no school): not a school role,
        // so not a can()/hasRole() check.
        key: "platform",
        label: t("sectionPlatform"),
        items: when(
          isPlatformSession(user),
          { href: "/platform", label: t("platformOverview"), icon: Gauge },
          { href: "/platform/schools", label: t("platformSchools"), icon: Building2 },
          { href: "/platform/plans", label: t("platformPlans"), icon: Layers },
          { href: "/platform/announcements", label: t("platformAnnouncements"), icon: Megaphone },
          { href: "/platform/audit", label: t("platformAudit"), icon: ScrollText }
        ),
      },
    ];

    return all.filter((section) => section.items.length > 0);
  }, [user, can, hasRole, t]);

  // The most specific link under the current page wins, so /students/12
  // highlights "All students" while /students/new highlights "Add student".
  const activeHref = useMemo(() => {
    let best: string | null = null;
    for (const item of sections.flatMap((s) => flatten(s.items))) {
      if (matches(pathname, item.href) && (!best || item.href.length > best.length)) best = item.href;
    }
    return best;
  }, [sections, pathname]);

  return { sections, activeHref };
}

/** Every leaf link with the section it sits in, for search. */
export function flattenSections(sections: NavSection[]): (NavItem & { section: string; group?: string })[] {
  return sections.flatMap((section) =>
    section.items.flatMap((item) =>
      item.children
        ? item.children.map((child) => ({ ...child, section: section.label, group: item.label }))
        : [{ ...item, section: section.label }]
    )
  );
}
