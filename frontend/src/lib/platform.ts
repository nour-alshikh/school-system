import type { User } from "@/types/auth";

/**
 * Signed in through the system admin login (platform token): a platform
 * admin with no current school. Platform pages need this; the same account
 * signed in as a school's admin gets 403 from platform routes.
 */
export function isPlatformSession(user: User | null | undefined): boolean {
  return !!user && user.is_platform_admin && !user.current_membership;
}
