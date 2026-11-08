import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { correctInsight, generateInsights, getIntelligence, intelligenceKeys, resetIntelligence, savePreferences } from "./api";

export function useIntelligence() {
  return useQuery({ queryKey: intelligenceKeys.overview, queryFn: getIntelligence, staleTime: 15_000 });
}

function useRefresh() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: intelligenceKeys.overview });
}

export function useSavePreferences() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: savePreferences, onSuccess: refresh });
}

export function useCorrectInsight() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: { id: string; status: "corrected" | "dismissed" | "active"; note: string }) =>
      correctInsight(v.id, v.status, v.note),
    onSuccess: refresh,
  });
}

export function useGenerateInsights() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: generateInsights, onSuccess: refresh });
}

export function useResetIntelligence() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: resetIntelligence, onSuccess: refresh });
}
