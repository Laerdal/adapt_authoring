// Fetches the logged-in engine user once on mount and exposes it app-wide.
// The /new SPA has no login of its own — it relies on the engine session cookie
// (log in via the legacy app). On failure `user` is null; consumers show a
// fallback rather than crashing.

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getCurrentUser, type CurrentUser } from "@/api/adaptAuthoring";

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, error: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null });

  useEffect(() => {
    let alive = true;
    getCurrentUser()
      .then((user) => alive && setState({ user, loading: false, error: null }))
      .catch((e: unknown) =>
        alive &&
        setState({ user: null, loading: false, error: e instanceof Error ? e.message : "not authenticated" })
      );
    return () => {
      alive = false;
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
