'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

export function usePlaylists(profileId: string | undefined) {
  return useQuery({
    queryKey: ['playlists', profileId],
    queryFn: async () => {
      if (!profileId) throw new Error('Missing profileId');
      return apiClient.user.listPlaylists({ profileId });
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
      return apiClient.user.createPlaylist({ profileId, name });
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
      return apiClient.user.deletePlaylist({ profileId, playlistId });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['playlists', profileId] });
    },
  });
}

export function usePlaylistItems(profileId: string | undefined, playlistId: string | undefined) {
  return useQuery({
    queryKey: ['playlist-items', profileId, playlistId],
    queryFn: async () => {
      if (!profileId || !playlistId) throw new Error('Missing params');
      return apiClient.user.listPlaylistItems({ profileId, playlistId });
    },
    enabled: !!profileId && !!playlistId,
    staleTime: 60_000,
  });
}

export function useAddPlaylistItem(profileId: string | undefined, playlistId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { contentUid: string; sortOrder?: number }) => {
      if (!profileId || !playlistId) throw new Error('Missing params');
      return apiClient.user.addPlaylistItem({ profileId, playlistId, ...p });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['playlist-items', profileId, playlistId] });
    },
  });
}

export function useRemovePlaylistItem(profileId: string | undefined, playlistId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contentUid: string) => {
      if (!profileId || !playlistId) throw new Error('Missing params');
      return apiClient.user.removePlaylistItem({ profileId, playlistId, contentUid });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['playlist-items', profileId, playlistId] });
    },
  });
}

