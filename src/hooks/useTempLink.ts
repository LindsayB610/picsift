/**
 * React Query hook for temporary image URLs
 */

import { useQuery } from '@tanstack/react-query';
import { getTempLink } from '../api';

/**
 * Hook to get a temporary display URL for a Dropbox file path
 */
export function useTempLink(path: string | null) {
  return useQuery({
    queryKey: ['tempLink', path],
    queryFn: async () => {
      if (!path) return null;
      const res = await getTempLink(path);
      return res.url;
    },
    enabled: typeof path === 'string' && path.length > 0,
    staleTime: 3 * 60 * 60 * 1000, // 3 hours (links expire in 4)
    gcTime: 3 * 60 * 60 * 1000,
  });
}
