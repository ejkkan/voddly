'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

export function useFavorites(profileId: string | undefined) {
  return useQuery({
    queryKey: ['favorites', profileId],
    queryFn: async () => {
      if (!profileId) throw new Error('Missing profileId');
      return apiClient.user.listFavorites(profileId);
    },
    enabled: !!profileId,
    staleTime: 60_000,
  });
}

export function useAddFavorite(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contentUid: string) => {
      if (!profileId) throw new Error('Missing profileId');
      return apiClient.user.addFavorite(profileId, { contentUid });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['favorites', profileId] });
    },
  });
}

export function useRemoveFavorite(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contentUid: string) => {
      if (!profileId) throw new Error('Missing profileId');
      return apiClient.user.removeFavorite(profileId, contentUid);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['favorites', profileId] });
    },
  });
}
