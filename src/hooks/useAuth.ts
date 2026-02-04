/**
 * React Query hooks for authentication
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { startAuth, checkAuthCallback } from "../api";
import type { AuthStartResponse, AuthCallbackResponse } from "../types";

/**
 * Hook to start OAuth flow
 */
export function useStartAuth() {
  return useMutation({
    mutationFn: async (): Promise<AuthStartResponse> => {
      return await startAuth();
    },
  });
}

/**
 * Hook to check OAuth callback
 * Only runs when code and state are present in URL
 */
export function useAuthCallback(code: string | null, state: string | null) {
  return useQuery({
    queryKey: ["auth", "callback", code, state],
    queryFn: async (): Promise<AuthCallbackResponse> => {
      if (!code || !state) {
        return {
          success: false,
          error: "Missing authorization code or state",
        };
      }
      return await checkAuthCallback();
    },
    enabled: Boolean(code && state), // Only run if both code and state exist
    retry: false, // Don't retry auth callbacks
  });
}
