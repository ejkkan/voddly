import { useMutation, useQueryClient } from '@tanstack/react-query';

import { syncSourcesWithBackend } from './management';

/**
 * Hook for synchronizing local sources with backend sources
 * Automatically removes orphaned sources and their data
 */
export function useSyncSources() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      accountId,
      backendSources,
    }: {
      accountId: string;
      backendSources: { id: string; name: string; kind: string }[];
    }) => {
      return syncSourcesWithBackend(accountId, backendSources);
    },
    onSuccess: () => {
      // Invalidate queries that depend on source data
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
