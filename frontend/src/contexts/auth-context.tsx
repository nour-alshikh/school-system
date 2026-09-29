"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api";
import type { LoginPayload, RegisterPayload } from "@/lib/schemas";
import type {
  NewSchoolPayload,
  SchoolSignupPayload,
} from "@/features/school-signup/schema";
import type { User } from "@/types/auth";

/** Step one of the system admin login (see SystemLoginPage). */
export interface TwoFactorChallenge {
  two_factor: "setup" | "challenge";
  challenge_id: string;
  /** Only when setting up: the new secret to scan or type into the app. */
  secret?: string;
  otpauth_url?: string;
  qr_svg?: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  /** System admin, step one: email + password start a two-factor challenge. */
  startSystemLogin: (email: string, password: string) => Promise<TwoFactorChallenge>;
  /**
   * Step two: a code (or recovery code) signs in with a platform token.
   * Returns the recovery codes right after first-time setup, to show once.
   */
  completeSystemLogin: (
    challengeId: string,
    answer: { code?: string; recovery_code?: string }
  ) => Promise<string[] | null>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * System admin: re-confirms with a fresh code, then opens `schoolId` as its
   * admin (central dashboard, phase 5). The platform session waits aside.
   */
  enterSchool: (schoolId: number, code: string, reason?: string) => Promise<void>;
  /** Leaves the school, back to the platform session. */
  exitSchool: () => Promise<void>;
  /** Moves the session to another of the user's memberships (school + role). */
  switchSchool: (membershipId: number) => Promise<void>;
  /** A guest creates an account and a school, and is signed in as its admin. */
  signUpSchool: (payload: SchoolSignupPayload) => Promise<void>;
  /** The signed-in user creates a school; the session moves to it. */
  createSchool: (payload: NewSchoolPayload) => Promise<void>;
  can: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  uploadAvatar: (file: File) => Promise<void>;
  removeAvatar: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USER_QUERY_KEY = ["auth", "user"];

const AUTH_STATUS_COOKIE =
  process.env.NEXT_PUBLIC_AUTH_STATUS_COOKIE ?? "auth_status";

function hasAuthStatusCookie(): boolean {
  return document.cookie
    .split("; ")
    .some((entry) => entry.startsWith(`${AUTH_STATUS_COOKIE}=`));
}

async function fetchCurrentUser(): Promise<User | null> {
  // No marker cookie means no session was ever established — skip the
  // request instead of firing a guaranteed 401 on every guest page load.
  if (!hasAuthStatusCookie()) {
    return null;
  }

  try {
    const data = await apiFetch<{ user: User }>("/api/user");
    return data.user;
  } catch (error) {
    // A 401 just means "not logged in" — that's a valid, successful result
    // for this query, not a failure to retry.
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user = null, isLoading } = useQuery({
    queryKey: USER_QUERY_KEY,
    queryFn: fetchCurrentUser,
    retry: false,
  });

  const setUser = useCallback(
    (next: User | null) => queryClient.setQueryData<User | null>(USER_QUERY_KEY, next),
    [queryClient]
  );

  const loginMutation = useMutation({
    mutationFn: (payload: LoginPayload) =>
      apiFetch<{ user: User }>("/api/login", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => setUser(data.user),
  });

  const registerMutation = useMutation({
    mutationFn: (payload: RegisterPayload) =>
      apiFetch<{ user: User }>("/api/register", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => setUser(data.user),
  });

  const switchSchoolMutation = useMutation({
    mutationFn: (membershipId: number) =>
      apiFetch<{ user: User }>("/api/switch-school", {
        method: "POST",
        body: JSON.stringify({ membership_id: membershipId }),
      }),
    onSuccess: (data) => {
      // Everything cached so far belongs to the previous school.
      queryClient.clear();
      setUser(data.user);
    },
  });

  // Both answer like switch-school: the user as admin of the new school,
  // with the session cookie now bound to it (see the BFF route).
  const signUpSchoolMutation = useMutation({
    mutationFn: (payload: SchoolSignupPayload) =>
      apiFetch<{ user: User }>("/api/school-signup", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      queryClient.clear();
      setUser(data.user);
    },
  });

  const createSchoolMutation = useMutation({
    mutationFn: (payload: NewSchoolPayload) =>
      apiFetch<{ user: User }>("/api/schools", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      // Everything cached so far belongs to the previous school.
      queryClient.clear();
      setUser(data.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiFetch<void>("/api/logout", { method: "POST" }),
    onSuccess: () => setUser(null),
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("avatar", file);

      return apiFetch<{ avatar_url: string }>("/api/user/avatar", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: (data) =>
      queryClient.setQueryData<User | null>(USER_QUERY_KEY, (prev) =>
        prev ? { ...prev, avatar_url: data.avatar_url } : prev
      ),
  });

  const removeAvatarMutation = useMutation({
    mutationFn: () => apiFetch<void>("/api/user/avatar", { method: "DELETE" }),
    onSuccess: () =>
      queryClient.setQueryData<User | null>(USER_QUERY_KEY, (prev) =>
        prev ? { ...prev, avatar_url: null } : prev
      ),
  });

  const login = useCallback(
    async (payload: LoginPayload) => {
      await loginMutation.mutateAsync(payload);
    },
    [loginMutation]
  );

  const startSystemLogin = useCallback(
    (email: string, password: string) =>
      apiFetch<TwoFactorChallenge>("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password, role: "system" }),
      }),
    []
  );

  const completeSystemLogin = useCallback(
    async (
      challengeId: string,
      answer: { code?: string; recovery_code?: string }
    ) => {
      const data = await apiFetch<{ user: User; recovery_codes?: string[] }>(
        "/api/login/two-factor",
        {
          method: "POST",
          body: JSON.stringify({ challenge_id: challengeId, ...answer }),
        }
      );
      // Nothing cached so far belongs to a platform session.
      queryClient.clear();
      setUser(data.user);
      return data.recovery_codes ?? null;
    },
    [queryClient, setUser]
  );

  const enterSchool = useCallback(
    async (schoolId: number, code: string, reason?: string) => {
      await apiFetch<void>("/api/platform/confirm", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      const data = await apiFetch<{ user: User }>(`/api/platform/schools/${schoolId}/enter`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || null }),
      });
      // Nothing cached on the platform side belongs to the school.
      queryClient.clear();
      setUser(data.user);
    },
    [queryClient, setUser]
  );

  const exitSchool = useCallback(async () => {
    await apiFetch<void>("/api/platform/exit", { method: "POST" });
    queryClient.clear();
    setUser(await fetchCurrentUser());
  }, [queryClient, setUser]);

  const register = useCallback(
    async (payload: RegisterPayload) => {
      await registerMutation.mutateAsync(payload);
    },
    [registerMutation]
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const switchSchool = useCallback(
    async (membershipId: number) => {
      await switchSchoolMutation.mutateAsync(membershipId);
    },
    [switchSchoolMutation]
  );

  const signUpSchool = useCallback(
    async (payload: SchoolSignupPayload) => {
      await signUpSchoolMutation.mutateAsync(payload);
    },
    [signUpSchoolMutation]
  );

  const createSchool = useCallback(
    async (payload: NewSchoolPayload) => {
      await createSchoolMutation.mutateAsync(payload);
    },
    [createSchoolMutation]
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      await uploadAvatarMutation.mutateAsync(file);
    },
    [uploadAvatarMutation]
  );

  const removeAvatar = useCallback(async () => {
    await removeAvatarMutation.mutateAsync();
  }, [removeAvatarMutation]);

  const can = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user]
  );

  const hasRole = useCallback(
    (role: string) => user?.roles.includes(role) ?? false,
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        startSystemLogin,
        completeSystemLogin,
        enterSchool,
        exitSchool,
        register,
        logout,
        switchSchool,
        signUpSchool,
        createSchool,
        can,
        hasRole,
        uploadAvatar,
        removeAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
