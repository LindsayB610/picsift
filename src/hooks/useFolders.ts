/**
 * React Query hooks for folder operations
 */

import { useQuery } from "@tanstack/react-query";
import { discoverFolders } from "../api";
import type { DiscoverFoldersResponse } from "../types";

/**
 * Hook to discover folders with images
 */
export function useDiscoverFolders(maxDepth: number = 3) {
  return useQuery({
    queryKey: ["folders", "discover", maxDepth],
    queryFn: async (): Promise<DiscoverFoldersResponse> => {
      return await discoverFolders(maxDepth);
    },
    staleTime: 60 * 60 * 1000, // Cache for 1 hour (folders don't change often)
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}
