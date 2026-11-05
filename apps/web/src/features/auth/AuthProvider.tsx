import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigError } from "../../lib/supabase";
import { signOutCurrentSession } from "./api/auth";
import { AuthContext } from "./context";
import type { AuthContextValue, AuthStatus } from "./types/auth";

/**
 * Owns the single Supabase auth subscription for the app.
 *
 * - `getSession()` resolves the initial persisted session.
 * - `onAuthStateChange` keeps it in sync (sign in, sign out, token refresh, recovery).
 * - The subscription is removed on unmount; StrictMode's double mount therefore
 *   leaves only one active listener.
 * - If a state event arrives before `getSession()` resolves, the event wins, so a
 *   stale initial read cannot resurrect a signed-out session.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    let eventReceived = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      eventReceived = true;
      setSession(nextSession);
      setLoading(false);
    });

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || eventReceived) return;
        if (!error) setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await signOutCurrentSession();
  }, []);

  const status: AuthStatus = !supabase
    ? "unconfigured"
    : loading
      ? "loading"
      : session?.user
        ? "authenticated"
        : "unauthenticated";

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      configurationError: supabaseConfigError,
      signOut,
    }),
    [status, session, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
