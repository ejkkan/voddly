import React from 'react';

import { Image, Pressable, Text, View } from '@/components/ui';
import { normalizeImageUrl } from '@/lib/url-utils';
import { useSourceBaseUrl } from '@/hooks/useSourceInfo';

type PosterCardProps = {
  id: string | number;
  title: string;
  posterUrl?: string | null;
  onPress?: (id: string | number) => void;
  aspect?: 'poster' | 'backdrop';
  sourceId?: string; // optional, to normalize raw URLs when base not embedded
};

export const PosterCard = ({
  id,
  title,
  posterUrl,
  onPress,
  aspect = 'poster',
  sourceId,
}: PosterCardProps) => {
  const isPoster = aspect === 'poster';
  const { baseUrl } = useSourceBaseUrl(sourceId);
  const normalized = normalizeImageUrl(posterUrl || null, baseUrl || undefined);
  return (
    <Pressable onPress={() => onPress?.(id)} className="mr-3">
      <View className="overflow-hidden rounded-xl">
        {normalized ? (
          <Image
            source={{ uri: normalized }}
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
      </View>
      <Text
        numberOfLines={1}
        className="mt-2 w-36 text-sm text-neutral-900 dark:text-white md:w-44 lg:w-48"
      >
        {title}
      </Text>
    </Pressable>
  );
};

export default PosterCard;
