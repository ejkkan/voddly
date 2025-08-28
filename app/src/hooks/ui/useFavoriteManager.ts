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
      (item) => item.content_uid === String(contentId)
    );
  };

  const toggleFavorite = async (contentId: string | number) => {
    if (!profileId) {
      console.warn('Cannot toggle favorite: no profile ID available');
      return;
    }

    const contentUid = String(contentId);
    const currentlyFavorite = isFavorite(contentId);

    try {
      if (currentlyFavorite) {
        await removeFavorite.mutateAsync(contentUid);
      } else {
        await addFavorite.mutateAsync(contentUid);
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
