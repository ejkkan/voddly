import React, { useState } from 'react';

import { Image, Pressable, Text, View } from '@/components/ui';
import { Heart, Playlist } from '@/components/ui/icons';

import { PlaylistModal } from './PlaylistModal';

type PosterCardProps = {
  id: string | number;
  title: string;
  posterUrl?: string | null;
  _sourceId?: string;
  onPress?: (id: string | number) => void;
  onLongPress?: (id: string | number) => void;
  aspect?: 'poster' | 'backdrop';
  isFavorite?: boolean;
  onToggleFavorite?: (id: string | number) => void;
  showFavoriteButton?: boolean;
  showPlaylistButton?: boolean;
  hasProfile?: boolean;
  _contentType?: 'movie' | 'series' | 'tv' | 'category';
  isInPlaylist?: boolean;
};

export const PosterCard = ({
  id,
  title,
  posterUrl,
  _sourceId,
  onPress,
  onLongPress,
  aspect = 'poster',
  isFavorite = false,
  onToggleFavorite,
  showFavoriteButton = true,
  showPlaylistButton = true,
  hasProfile = true,
  _contentType = 'movie',
  isInPlaylist = false,
}: PosterCardProps) => {
  const isPoster = aspect === 'poster';
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  const handleFavoritePress = (e: any) => {
    e.stopPropagation();
    if (hasProfile && onToggleFavorite) {
      onToggleFavorite(id);
    }
  };

  const handlePlaylistPress = (e: any) => {
    e.stopPropagation();
    if (hasProfile) {
      setShowPlaylistModal(true);
    }
  };

  return (
    <Pressable
      onPress={() => onPress?.(id)}
      onLongPress={() => onLongPress?.(id)}
      className="mr-3"
    >
      <View className="relative overflow-hidden rounded-xl">
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            contentFit="cover"
            className={
              isPoster
                ? 'h-56 w-36 md:h-64 md:w-44 lg:h-72 lg:w-48'
                : 'h-40 w-64 md:h-48 md:w-80 lg:h-56 lg:w-96'
            }
          />
        ) : (
          <View
            className={
              isPoster
                ? 'h-56 w-36 items-center justify-center bg-neutral-200 dark:bg-neutral-800 md:h-64 md:w-44 lg:h-72 lg:w-48'
                : 'h-40 w-64 items-center justify-center bg-neutral-200 dark:bg-neutral-800 md:h-48 md:w-80 lg:h-56 lg:w-96'
            }
          >
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              No image
            </Text>
          </View>
        )}

        {/* Action Buttons Container */}
        <View className="absolute right-2 top-2 flex-row gap-2">
          {/* Playlist Icon */}
          {showPlaylistButton && (
            <Pressable
              onPress={handlePlaylistPress}
              className={`rounded-full p-1 ${
                hasProfile
                  ? 'bg-black/50 backdrop-blur-sm'
                  : 'bg-black/30 opacity-50 backdrop-blur-sm'
              }`}
              disabled={!hasProfile}
            >
              <Playlist
                filled={isInPlaylist}
                color={isInPlaylist ? '#007AFF' : '#ffffff'}
              />
            </Pressable>
          )}

          {/* Favorite Heart Icon */}
          {showFavoriteButton && onToggleFavorite && (
            <Pressable
              onPress={handleFavoritePress}
              className={`rounded-full p-1 ${
                hasProfile
                  ? 'bg-black/50 backdrop-blur-sm'
                  : 'bg-black/30 opacity-50 backdrop-blur-sm'
              }`}
              disabled={!hasProfile}
            >
              <Heart
                filled={isFavorite}
                color={isFavorite ? '#ef4444' : '#ffffff'}
              />
            </Pressable>
          )}
        </View>
      </View>
      <Text
        numberOfLines={1}
        className="mt-2 w-36 text-sm text-neutral-900 dark:text-white md:w-44 lg:w-48"
      >
        {title}
      </Text>

      {/* Playlist Modal */}
      <PlaylistModal
        visible={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        contentId={String(id)}
        contentTitle={title}
      />
    </Pressable>
  );
};

export default PosterCard;
