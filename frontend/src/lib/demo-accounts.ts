/**
 * Seeded demo accounts (backend DemoSeeder, docs/demo-accounts.md), one
 * per login form, for the "Use demo account" button. Only shown when the
 * frontend is built with NEXT_PUBLIC_DEMO_LOGINS=true: a demo/testing
 * deployment, never a real one.
 */
export const DEMO_LOGINS_ENABLED = process.env.NEXT_PUBLIC_DEMO_LOGINS === "true";

export const DEMO_PASSWORD = "password";

export const DEMO_ACCOUNTS: Record<"admin" | "teacher" | "student" | "parent" | "system", string> = {
  // Admin at both demo schools: shows the school picker, then the switcher.
  admin: "admin@demo.school",
  teacher: "mona.ali@teachers.demo",
  student: "ali.hassan1.student@demo.school",
  // A child at each school: shows the parent overview with two children.
  parent: "family.parent@demo.school",
  // Platform only, no school roles. A demo deployment signs it in without
  // two-factor (backend config platform.two_factor follows DEMO_MODE).
  system: "system@demo.school",
};
