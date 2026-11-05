import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && publishableKey);

export const supabaseConfigError = isSupabaseConfigured
  ? null
  : "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local at the repository root, then restart the dev server.";

/**
 * Single browser client for the whole app.
 *
 * - PKCE flow (recommended for SPAs). The auth redirect is completed explicitly
 *   by /auth/callback and /reset-password through supabase.auth.exchangeCodeForSession
 *   or verifyOtp, so `detectSessionInUrl` stays off and no redirect is processed twice.
 * - Session persistence and refresh are handled by supabase-js. The app never reads,
 *   writes or forwards access/refresh tokens itself.
 * - Only the publishable (anon) key is ever used in the browser.
 */
export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(url!, publishableKey!, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "frikhii.auth",
      },
    })
  : null;

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(supabaseConfigError ?? "Supabase is not configured.");
  }
  return supabase;
}
