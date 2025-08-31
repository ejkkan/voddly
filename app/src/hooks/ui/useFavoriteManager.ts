import {
  useAddFavorite,
  useFavorites,
  useRemoveFavorite,
} from '@/hooks/useFavorites';

import { useCurrentProfile } from './useCurrentProfile';

export function useFavoriteManager() {
  const { profileId, isLoading: isProfileLoading } = useCurrentProfile();

  const { data: favoritesData, isLoading: isFavoritesLoading } =
    useFavorites(profileId);
  const addFavorite = useAddFavorite(profileId);
  const removeFavorite = useRemoveFavorite(profileId);

  const isLoading = isProfileLoading || isFavoritesLoading;

  const isFavorite = (contentId: string | number) => {
    if (!profileId || !favoritesData?.items) return false;
    return favoritesData.items.some(
      (item) => item.content_id === String(contentId)
    );
  };

  const toggleFavorite = async (
    contentId: string | number,
    contentType: 'movie' | 'series' | 'tv' | 'category' | 'channel' = 'movie'
  ) => {
    if (!profileId) {
      console.warn('Cannot toggle favorite: no profile ID available');
      return;
    }

    const contentIdStr = String(contentId);
    const currentlyFavorite = isFavorite(contentId);

    try {
      if (currentlyFavorite) {
        await removeFavorite.mutateAsync(contentIdStr);
      } else {
        await addFavorite.mutateAsync({ contentId: contentIdStr, contentType });
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  return {
    profileId,
    isLoading,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    hasProfile: !!profileId,
  };
}
