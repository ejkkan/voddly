'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

export function usePlaylists(profileId: string | undefined) {
  return useQuery({
    queryKey: ['playlists', profileId],
    queryFn: async () => {
      if (!profileId) throw new Error('Missing profileId');
      return apiClient.user.listPlaylists(profileId);
    },
    enabled: !!profileId,
    staleTime: 60_000,
  });
}

export function useCreatePlaylist(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!profileId) throw new Error('Missing profileId');
      return apiClient.user.createPlaylist(profileId, { name });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['playlists', profileId] });
    },
  });
}

export function useDeletePlaylist(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (playlistId: string) => {
      if (!profileId) throw new Error('Missing profileId');
      return apiClient.user.deletePlaylist(profileId, playlistId);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['playlists', profileId] });
    },
  });
}

export function useAddToPlaylist(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistId,
      contentId,
    }: {
      playlistId: string;
      contentId: string;
    }) => {
      if (!profileId) throw new Error('Missing profileId');
      return apiClient.user.addPlaylistItem(profileId, playlistId, {
        contentId,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['playlists', profileId] });
    },
  });
}

export function useRemoveFromPlaylist(profileId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistId,
      contentId,
    }: {
      playlistId: string;
      contentId: string;
    }) => {
      if (!profileId) throw new Error('Missing profileId');
      return apiClient.user.removePlaylistItem(
        profileId,
        playlistId,
        contentId
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['playlists', profileId] });
    },
  });
}
