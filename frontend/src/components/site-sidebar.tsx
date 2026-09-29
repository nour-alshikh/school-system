"use client";

import { useState, type ComponentType } from "react";
import { useTranslations } from "next-intl";
import {
  Award,
  BookOpen,
  Building2,
  ShieldCheck,
  Gauge,
  Megaphone,
  ScrollText,
  CalendarRange,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  DoorOpen,
  DollarSign,
  GraduationCap,
  History,
  Library,
  LayoutDashboard,
  Layers,
  Link2,
  List,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  TrendingUp,
  User as UserIcon,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/contexts/auth-context";
import { isPlatformSession } from "@/lib/platform";
import { useStaggerIn } from "@/hooks/use-stagger-in";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "sidebar-collapsed";

// SiteSidebar never renders real DOM during SSR — it returns null until
// useAuth() resolves (well after hydration) — so reading localStorage in
// this lazy initializer can't cause a hydration mismatch, and avoids the
// setState-in-effect this project's lint rule flags for the usual
// "sync from localStorage in an effect" pattern.
function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function readStoredGroupOpen(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "1";
  } catch {
    return fallback;
  }
}

// Groups an index page + its create page under one collapsible entry
// (e.g. "Students" -> "All students" / "Add student") instead of two flat
// top-level links. Collapses to a single link to `fallbackHref` when the
// whole sidebar itself is icon-only, since there's no room to nest there.
function SidebarGroup({
  icon: Icon,
  label,
  collapsed,
  storageKey,
  fallbackHref,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
  storageKey: string;
  fallbackHref: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(() => readStoredGroupOpen(storageKey, false));

  if (collapsed) {
    return (
      <SidebarLink
        href={fallbackHref}
        icon={Icon}
        label={label}
        collapsed={collapsed}
      />
    );
  }

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-1" data-animate="sidebar-link">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-primary/10"
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 truncate text-start">{label}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="flex flex-col gap-1 ps-4">{children}</div>}
    </div>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  collapsed,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      data-animate="sidebar-link"
      className={cn(
        "flex items-center gap-2 truncate rounded-md px-3 py-2 text-sm transition-colors",
        collapsed && "justify-center px-2",
        isActive
          ? "bg-primary font-medium text-primary-foreground"
          : "hover:bg-primary/10"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && label}
    </Link>
  );
}

export function SiteSidebar() {
  const t = useTranslations("Nav");
  const { user, isLoading, can, hasRole } = useAuth();
  // Modules outside the school's plan are hidden (the API refuses them too).
  // No plan info (no current school) hides nothing.
  const hasFeature = (feature: string) => !user?.plan_features || user.plan_features.includes(feature);
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);
  const ref = useStaggerIn<HTMLElement>({ selector: "[data-animate='sidebar-link']" });

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  // Same guest/loading gate as SiteHeader's user menu — no sidebar until
  // there's someone logged in to show nav for. The landing page is a
  // full-width marketing page even for logged-in users, so it never gets
  // a sidebar either.
  if (isLoading || !user || pathname === "/") return null;

  return (
    <nav
      ref={ref}
      className={cn(
        "hidden shrink-0 flex-col gap-1 border-e p-2 transition-[width] duration-150 print:hidden md:flex",
        "border-primary/15 bg-primary/[0.05] dark:border-sidebar-border dark:bg-sidebar dark:text-sidebar-foreground",
        collapsed ? "w-12 items-center" : "w-64 p-4"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
        className="mb-2 self-end"
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4" />
        ) : (
          <PanelLeftClose className="size-4" />
        )}
      </Button>

      <SidebarLink
        href="/dashboard"
        icon={LayoutDashboard}
        label={t("dashboard")}
        collapsed={collapsed}
      />

      {hasRole("parent") && (
        <>
          <SidebarLink
            href="/parent"
            icon={UserIcon}
            label={t("myInfo")}
            collapsed={collapsed}
          />
          <SidebarLink
            href="/parent-attendance"
            icon={CheckSquare}
            label={t("myAttendance")}
            collapsed={collapsed}
          />
          {hasFeature("fees") && (
            <SidebarLink
              href="/parent-fees"
              icon={DollarSign}
              label={t("myFees")}
              collapsed={collapsed}
            />
          )}
          {hasFeature("library") && (
            <SidebarLink
              href="/parent-library"
              icon={Library}
              label={t("library")}
              collapsed={collapsed}
            />
          )}
        </>
      )}

      {hasRole("student") && (
        <SidebarGroup
          icon={UserIcon}
          label={t("myPortal")}
          collapsed={collapsed}
          storageKey="sidebar-student-group-open"
          fallbackHref="/my-exams"
        >
          {hasFeature("exams") && (
            <SidebarLink
              href="/my-exams"
              icon={ClipboardList}
              label={t("myExams")}
              collapsed={false}
            />
          )}
          <SidebarLink
            href="/my-attendance"
            icon={CheckSquare}
            label={t("myAttendance")}
            collapsed={false}
          />
          <SidebarLink
            href="/my-subjects"
            icon={BookOpen}
            label={t("mySubjects")}
            collapsed={false}
          />
          {hasFeature("fees") && (
            <SidebarLink
              href="/my-fees"
              icon={DollarSign}
              label={t("myFees")}
              collapsed={false}
            />
          )}
          {hasFeature("library") && (
            <SidebarLink
              href="/my-library"
              icon={Library}
              label={t("library")}
              collapsed={false}
            />
          )}
        </SidebarGroup>
      )}

      {/* The academic structure is admin territory — same gate as its API
          routes (manage-academics or manage-students), so parents/students
          never see a link to a page their requests would 403 on. */}
      {(can("manage-academics") || can("manage-students")) && (
        <>
          <SidebarLink
            href="/stages"
            icon={GraduationCap}
            label={t("stages")}
            collapsed={collapsed}
          />
          <SidebarLink
            href="/grades"
            icon={Layers}
            label={t("grades")}
            collapsed={collapsed}
          />
          <SidebarLink
            href="/classrooms"
            icon={DoorOpen}
            label={t("classrooms")}
            collapsed={collapsed}
          />
          <SidebarLink
            href="/academic-years"
            icon={CalendarRange}
            label={t("academicYears")}
            collapsed={collapsed}
          />
          <SidebarLink
            href="/subjects"
            icon={BookOpen}
            label={t("subjects")}
            collapsed={collapsed}
          />
        </>
      )}

      {can("manage-students") && (
        <SidebarGroup
          icon={UserPlus}
          label={t("students")}
          collapsed={collapsed}
          storageKey="sidebar-students-group-open"
          fallbackHref="/students"
        >
          <SidebarLink
            href="/students"
            icon={List}
            label={t("allStudents")}
            collapsed={false}
          />
          <SidebarLink
            href="/students/new"
            icon={Plus}
            label={t("addStudent")}
            collapsed={false}
          />
          <SidebarLink
            href="/promotions"
            icon={TrendingUp}
            label={t("promoteStudents")}
            collapsed={false}
          />
          <SidebarLink
            href="/promotions/history"
            icon={History}
            label={t("promotionHistory")}
            collapsed={false}
          />
          <SidebarLink
            href="/graduations"
            icon={Award}
            label={t("graduateStudents")}
            collapsed={false}
          />
          <SidebarLink
            href="/graduations/history"
            icon={History}
            label={t("graduationHistory")}
            collapsed={false}
          />
        </SidebarGroup>
      )}

      {can("manage-teachers") && (
        <SidebarGroup
          icon={UserCog}
          label={t("teachers")}
          collapsed={collapsed}
          storageKey="sidebar-teachers-group-open"
          fallbackHref="/teachers"
        >
          <SidebarLink
            href="/teachers"
            icon={List}
            label={t("allTeachers")}
            collapsed={false}
          />
          <SidebarLink
            href="/teacher-subjects"
            icon={Link2}
            label={t("teacherSubjects")}
            collapsed={false}
          />
        </SidebarGroup>
      )}

      {can("manage-fees") && hasFeature("fees") && (
        <SidebarLink
          href="/fees"
          icon={DollarSign}
          label={t("fees")}
          collapsed={collapsed}
        />
      )}

      {hasRole("teacher") && (
        <SidebarLink
          href="/my-classrooms"
          icon={DoorOpen}
          label={t("myClassrooms")}
          collapsed={collapsed}
        />
      )}

      {(can("manage-attendance") || hasRole("teacher")) && (
        <SidebarGroup
          icon={CheckSquare}
          label={t("attendance")}
          collapsed={collapsed}
          storageKey="sidebar-attendance-group-open"
          fallbackHref="/attendance"
        >
          <SidebarLink
            href="/attendance"
            icon={CheckSquare}
            label={t("takeAttendance")}
            collapsed={false}
          />
          <SidebarLink
            href="/attendance/history"
            icon={History}
            label={t("attendanceHistory")}
            collapsed={false}
          />
        </SidebarGroup>
      )}

      {(can("manage-exams") || hasRole("teacher")) && hasFeature("exams") && (
        <SidebarGroup
          icon={ClipboardList}
          label={t("exams")}
          collapsed={collapsed}
          storageKey="sidebar-exams-group-open"
          fallbackHref="/exams"
        >
          <SidebarLink
            href="/exams"
            icon={List}
            label={t("allExams")}
            collapsed={false}
          />
          <SidebarLink
            href="/exams/new"
            icon={Plus}
            label={t("createExam")}
            collapsed={false}
          />
        </SidebarGroup>
      )}

      {(can("manage-academics") || hasRole("teacher")) && hasFeature("library") && (
        <SidebarLink
          href="/library"
          icon={Library}
          label={t("library")}
          collapsed={collapsed}
        />
      )}

      {can("manage-users") && (
        <SidebarLink
          href="/admin/users"
          icon={Users}
          label={t("manageUsers")}
          collapsed={collapsed}
        />
      )}

      {can("manage-settings") && (
        <SidebarLink
          href="/admin/settings"
          icon={Settings}
          label={t("settings")}
          collapsed={collapsed}
        />
      )}

      {hasRole("admin") && (
        <SidebarLink
          href="/admin/system-admin-activity"
          icon={ShieldCheck}
          label={t("systemAdminActivity")}
          collapsed={collapsed}
        />
      )}

      {/* A system admin's platform session (signed in through the system
          admin login, so no school): not a school role, so not a
          can()/hasRole() check. A school token can't reach platform pages. */}
      {isPlatformSession(user) && (
        <>
          <SidebarLink
            href="/platform"
            icon={Gauge}
            label={t("platformOverview")}
            collapsed={collapsed}
          />
          <SidebarLink
            href="/platform/schools"
            icon={Building2}
            label={t("platformSchools")}
            collapsed={collapsed}
          />
          <SidebarLink
            href="/platform/plans"
            icon={Layers}
            label={t("platformPlans")}
            collapsed={collapsed}
          />
          <SidebarLink
            href="/platform/announcements"
            icon={Megaphone}
            label={t("platformAnnouncements")}
            collapsed={collapsed}
          />
          <SidebarLink
            href="/platform/audit"
            icon={ScrollText}
            label={t("platformAudit")}
            collapsed={collapsed}
          />
        </>
      )}
    </nav>
  );
}
