import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context";

/**
 * Removes cached profile/preference data when the signed-in user changes or
 * signs out, so data from one account can never be shown to another.
 */
export function AuthQueryReset() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const nextUserId = user?.id ?? null;

    // Skip the first run: there is no cache to clear yet.
    if (previousUserId.current !== undefined && previousUserId.current !== nextUserId) {
      queryClient.removeQueries();
    }
    previousUserId.current = nextUserId;
  }, [user?.id, queryClient]);

  return null;
}
