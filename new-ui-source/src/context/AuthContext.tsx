// Fetches the logged-in engine user once on mount and exposes it app-wide.
// The /new SPA has no login of its own — it relies on the engine session cookie
// (log in via the legacy app).
//
// A never-logged-in visitor's /api/user/me call fails with 403 here (this
// backend uses 403, not 401, for "no session at all" - confirmed live), which
// api/client.ts's session-expiry handling doesn't cover (that's specifically
// for a session dying mid-use, detected via 401). Left unhandled, this used
// to just render every page with `user: null` and no redirect anywhere -
// a permanently blank app shell with no way back to login. Any failure here
// - this call's only purpose is checking login state - now sends the user to
// login (SSO if configured, otherwise the classic UI's own form) rather than
// leaving them stuck.

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getCurrentUser, type CurrentUser } from "@/api/adaptAuthoring";
import { redirectToLogin } from "@/utils/authRedirect";

export type AppRole = "Super Admin" | "Course Creator" | "Authenticated User";
export type DashboardSection =
  | "my-courses"
  | "shared"
  | "asset-management"
  | "template-management"
  | "user-management"
  | "plugin-management";

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, error: null });

export function normalizeRoleName(rawRole?: string): AppRole {
  const normalized = rawRole?.trim();
  if (normalized === "Super Admin" || normalized === "Course Creator" || normalized === "Authenticated User") {
    return normalized;
  }
  return "Authenticated User";
}

export function getUserRole(user: CurrentUser | null | undefined): AppRole {
  const roleFromArray = user?.rolesAsName?.find((role) =>
    role === "Super Admin" || role === "Course Creator" || role === "Authenticated User"
  );
  return normalizeRoleName(roleFromArray ?? user?.rolesAsName?.[0]);
}

export function isSuperAdmin(user: CurrentUser | null | undefined): boolean {
  return getUserRole(user) === "Super Admin";
}

export function canManageCourses(user: CurrentUser | null | undefined): boolean {
  const role = getUserRole(user);
  return role === "Super Admin" || role === "Course Creator";
}

export function canAccessCourseSettings(user: CurrentUser | null | undefined): boolean {
  return canManageCourses(user);
}

export function canAccessDashboardSection(
  user: CurrentUser | null | undefined,
  section: DashboardSection
): boolean {
  if (section === "user-management" || section === "plugin-management") {
    return isSuperAdmin(user);
  }
  return true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null });

  useEffect(() => {
    let alive = true;
    getCurrentUser()
      .then((user) => alive && setState({ user, loading: false, error: null }))
      .catch((e: unknown) => {
        if (!alive) return;
        setState({ user: null, loading: false, error: e instanceof Error ? e.message : "not authenticated" });
        redirectToLogin();
      });
    return () => {
      alive = false;
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
