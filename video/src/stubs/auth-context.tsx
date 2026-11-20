import type { ReactNode } from "react";
import { users } from "../mock";

const admin = users.admin;

/** A signed-in demo admin, from mock.ts. Every permission check passes. */
export function useAuth() {
  return {
    user: admin,
    isLoading: false,
    can: () => true,
    hasRole: (role: string) => role === "admin",
    logout: async () => {},
    refresh: async () => {},
  };
}
export function useSessionHint() {
  return true;
}
export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
