import {
  useAddToPlaylist,
  useCreatePlaylist,
  useDeletePlaylist,
  usePlaylists,
  useRemoveFromPlaylist,
} from '@/hooks/usePlaylists';

import { useCurrentProfile } from './useCurrentProfile';

export function usePlaylistManager() {
  const { profileId, isLoading: isProfileLoading } = useCurrentProfile();

  const { data: playlistsData, isLoading: isPlaylistsLoading } =
    usePlaylists(profileId);
  const createPlaylist = useCreatePlaylist(profileId);
  const deletePlaylist = useDeletePlaylist(profileId);
  const addToPlaylist = useAddToPlaylist(profileId);
  const removeFromPlaylist = useRemoveFromPlaylist(profileId);

  const isLoading = isProfileLoading || isPlaylistsLoading;

  const isInPlaylist = (contentId: string | number, playlistId: string) => {
    if (!profileId || !playlistsData?.playlists) return false;
    const playlist = playlistsData.playlists.find((p) => p.id === playlistId);
    return playlist?.items?.includes(String(contentId)) ?? false;
  };

  const getPlaylistsForContent = (contentId: string | number) => {
    if (!profileId || !playlistsData?.playlists) return [];
    return playlistsData.playlists.filter((playlist) =>
      playlist.items?.includes(String(contentId))
    );
  };

  const isInAnyPlaylist = (contentId: string | number) => {
    if (!profileId || !playlistsData?.playlists) return false;
    return playlistsData.playlists.some((playlist) =>
      playlist.items?.includes(String(contentId))
    );
  };

  const togglePlaylistItem = async (
    playlistId: string,
    contentId: string | number
  ) => {
    if (!profileId) {
      console.warn('Cannot toggle playlist item: no profile ID available');
      return;
    }

    const contentIdStr = String(contentId);
    const currentlyInPlaylist = isInPlaylist(contentId, playlistId);

    try {
      if (currentlyInPlaylist) {
        await removeFromPlaylist.mutateAsync({
          playlistId,
          contentId: contentIdStr,
        });
      } else {
        await addToPlaylist.mutateAsync({
          playlistId,
          contentId: contentIdStr,
        });
      }
    } catch (error) {
      console.error('Failed to toggle playlist item:', error);
    }
  };

  return {
    profileId,
    isLoading,
    playlists: playlistsData?.playlists ?? [],
    isInPlaylist,
    getPlaylistsForContent,
    isInAnyPlaylist,
    togglePlaylistItem,
    createPlaylist,
    deletePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    hasProfile: !!profileId,
  };
}
