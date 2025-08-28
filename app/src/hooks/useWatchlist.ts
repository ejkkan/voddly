'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

export function useWatchlist(profileId: string | undefined) {
  return useQuery({
    queryKey: ['watchlist', profileId],
    queryFn: async () => {
      if (!profileId) throw new Error('Missing profileId');
      return apiClient.user.listWatchlist({ profileId });
    },
    enabled: !!profileId,
    staleTime: 60_000,
  });
}

export function useAddToWatchlist(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { contentUid: string; sortOrder?: number }) => {
      if (!profileId) throw new Error('Missing profileId');
      return apiClient.user.addToWatchlist({ profileId, ...p });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['watchlist', profileId] });
    },
  });
}

export function useRemoveFromWatchlist(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contentUid: string) => {
      if (!profileId) throw new Error('Missing profileId');
      return apiClient.user.removeFromWatchlist({ profileId, contentUid });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['watchlist', profileId] });
    },
  });
}

