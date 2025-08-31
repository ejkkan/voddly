'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

export function useFavorites(
  profileId: string | undefined,
  contentType?: 'movie' | 'series' | 'tv' | 'category' | 'channel'
) {
  return useQuery({
    queryKey: ['favorites', profileId, contentType || 'all'],
    queryFn: async () => {
      if (!profileId) throw new Error('Missing profileId');
      return apiClient.user.listFavorites(profileId, { contentType });
    },
    enabled: !!profileId,
    staleTime: 60_000,
  });
}

export function useAddFavorite(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      contentId: string;
      contentType: 'movie' | 'series' | 'tv' | 'category' | 'channel';
    }) => {
      if (!profileId) throw new Error('Missing profileId');
      const { contentId, contentType } = params;
      return apiClient.user.addFavorite(profileId, { contentId, contentType });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['favorites', profileId] });
    },
  });
}

export function useRemoveFavorite(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contentId: string) => {
      if (!profileId) throw new Error('Missing profileId');
      return apiClient.user.removeFavorite(profileId, contentId);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['favorites', profileId] });
    },
  });
}
