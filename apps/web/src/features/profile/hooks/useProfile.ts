import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import {
  ensurePreferences,
  ensureProfile,
  fetchPreferences,
  fetchProfile,
  updatePreferences,
  updateProfileName,
  type SupportedLanguage,
  type SupportedTheme,
} from "../api/profile";
import { profileKeys } from "../api/keys";

export function useProfile(user: User | null) {
  return useQuery({
    queryKey: profileKeys.detail(user?.id ?? "anonymous"),
    queryFn: async () => {
      if (!user) throw new Error("No authenticated user.");
      return (await fetchProfile(user.id)) ?? ensureProfile(user);
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    retry: 1,
  });
}

export function usePreferences(userId: string | null) {
  return useQuery({
    queryKey: profileKeys.preferences(userId ?? "anonymous"),
    queryFn: async () => {
      if (!userId) throw new Error("No authenticated user.");
      return (await fetchPreferences(userId)) ?? ensurePreferences(userId);
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useUpdateProfileName(user: User | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fullName: string) => {
      if (!user) throw new Error("No authenticated user.");
      return updateProfileName(user.id, fullName);
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.detail(profile.id), profile);
      void queryClient.invalidateQueries({ queryKey: profileKeys.detail(profile.id) });
    },
  });
}

export function useUpdatePreferences(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: {
      learning_language?: SupportedLanguage;
      preferred_theme?: SupportedTheme;
    }) => {
      if (!userId) throw new Error("No authenticated user.");
      return updatePreferences(userId, patch);
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(profileKeys.preferences(preferences.user_id), preferences);
      void queryClient.invalidateQueries({
        queryKey: profileKeys.preferences(preferences.user_id),
      });
    },
  });
}
