import React from 'react';

import { Image, Pressable, Text, View } from '@/components/ui';

type PosterCardProps = {
  id: string | number;
  title: string;
  posterUrl?: string | null;
  onPress?: (id: string | number) => void;
  onLongPress?: (id: string | number) => void;
  aspect?: 'poster' | 'backdrop';
};

export const PosterCard = ({
  id,
  title,
  posterUrl,
  onPress,
  onLongPress,
  aspect = 'poster',
}: PosterCardProps) => {
  const isPoster = aspect === 'poster';

  return (
    <Pressable
      onPress={() => onPress?.(id)}
      onLongPress={() => onLongPress?.(id)}
      className="mr-3"
    >
      <View className="overflow-hidden rounded-xl">
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
