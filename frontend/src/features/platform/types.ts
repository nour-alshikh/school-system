// Shapes of the central dashboard's API (backend App\Platform\SchoolMetrics
// and AuditLogResource). Hand-written: those build arrays, not
// #[TypeScript] classes. Keep in step with them.

export type SchoolWarning = "suspended" | "no_admin" | "inactive" | "attendance_gap";

export interface PlatformSchoolRow {
  id: number;
  name: string;
  slug: string;
  status: "active" | "suspended";
  source: "platform" | "self_service" | "seed";
  created_at: string;
  currency: string | null;
  students: number;
  teachers: number;
  parents: number;
  admins: number;
  /** Decimal string, in the school's currency. */
  outstanding: string;
  collected_this_month: string;
  active_users_7d: number;
  last_activity_at: string | null;
  last_attendance_on: string | null;
  storage_bytes: number;
  warnings: SchoolWarning[];
}

export interface PlatformOverview {
  totals: {
    schools: Record<string, number>;
    students: number;
    teachers: number;
    parents: number;
    active_users_7d: number;
  };
  /** One line per currency: amounts in different currencies aren't added up. */
  collected_this_month: { currency: string | null; amount: string }[];
  schools: PlatformSchoolRow[];
  generated_at: string;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  actor: { id: number; name: string; email: string } | null;
  school: { id: number; name: string; slug: string } | null;
  school_id: number | null;
  subject_type: string | null;
  subject_id: number | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export interface PlatformSchoolDetail {
  school: PlatformSchoolRow & {
    created_by: { id: number; name: string; email: string } | null;
    school_days: number[] | null;
  };
  admins: {
    id: number;
    name: string;
    email: string;
    status: string;
    last_login_at: string | null;
    last_seen_at: string | null;
  }[];
  /** Active memberships by role. */
  people: Partial<Record<"admin" | "teacher" | "parent" | "student", number>>;
  finance: {
    currency: string | null;
    year: number | null;
    charged: string;
    collected: string;
    outstanding: string;
    status_counts: Partial<Record<"paid" | "partial" | "unpaid" | "waived", number>>;
    collections_by_month: { month: string; amount: string }[];
  };
  activity: {
    active_7d_by_role: Record<string, number>;
    active_30d_by_role: Record<string, number>;
    /** School days in the last 30 with attendance recorded, 0–1. */
    attendance_rate_30d: number | null;
    recent: { name: string; email: string; role: string; last_seen_at: string | null }[];
  };
  usage: {
    storage_by_collection: { collection: string; bytes: number; files: number }[];
  };
  audit: AuditLogEntry[];
}
