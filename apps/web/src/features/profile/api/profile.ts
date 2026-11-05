import type { User } from "@supabase/supabase-js";
import type { Tables, TablesUpdate } from "../../../lib/database.types";
import { requireSupabase } from "../../../lib/supabase";

export type Profile = Tables<"profiles">;
export type UserPreferences = Tables<"user_preferences">;

export const SUPPORTED_LANGUAGES = ["id-ID", "en-US"] as const;
export const SUPPORTED_THEMES = ["system", "light"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type SupportedTheme = (typeof SUPPORTED_THEMES)[number];

const PROFILE_COLUMNS = "id, full_name, avatar_url, created_at, updated_at";
const PREFERENCE_COLUMNS =
  "user_id, learning_language, preferred_theme, created_at, updated_at";

function metadataName(user: User): string | null {
  const value = user.user_metadata?.full_name;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 120) : null;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await requireSupabase()
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Reads the profile, creating it from auth metadata if the signup trigger did
 * not run (for example an account created before this migration was applied).
 * The insert is permitted only for `auth.uid() = id` by RLS.
 */
export async function ensureProfile(user: User): Promise<Profile> {
  const existing = await fetchProfile(user.id);
  if (existing) return existing;

  const { data, error } = await requireSupabase()
    .from("profiles")
    .upsert({ id: user.id, full_name: metadataName(user) }, { onConflict: "id" })
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateProfileName(userId: string, fullName: string): Promise<Profile> {
  const { data, error } = await requireSupabase()
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchPreferences(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await requireSupabase()
    .from("user_preferences")
    .select(PREFERENCE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function ensurePreferences(userId: string): Promise<UserPreferences> {
  const existing = await fetchPreferences(userId);
  if (existing) return existing;

  const { data, error } = await requireSupabase()
    .from("user_preferences")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select(PREFERENCE_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updatePreferences(
  userId: string,
  patch: Pick<TablesUpdate<"user_preferences">, "learning_language" | "preferred_theme">,
): Promise<UserPreferences> {
  const { data, error } = await requireSupabase()
    .from("user_preferences")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" })
    .select(PREFERENCE_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export function displayName(profile: Profile | null | undefined, user: User | null): string {
  const fromProfile = profile?.full_name?.trim();
  if (fromProfile) return fromProfile;

  if (user) {
    const fromMetadata = metadataName(user);
    if (fromMetadata) return fromMetadata;
    const localPart = user.email?.split("@")[0]?.trim();
    if (localPart) return localPart;
  }

  return "Learner";
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
