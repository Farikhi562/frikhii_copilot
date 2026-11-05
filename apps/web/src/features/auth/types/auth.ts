export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "unconfigured";

export type AuthContextValue = {
  status: AuthStatus;
  session: import("@supabase/supabase-js").Session | null;
  user: import("@supabase/supabase-js").User | null;
  configurationError: string | null;
  signOut: () => Promise<void>;
};
