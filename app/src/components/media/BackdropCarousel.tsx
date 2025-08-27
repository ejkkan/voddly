import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  View,
  type ViewToken,
} from 'react-native';

import { Image } from '@/components/ui';

interface BackdropCarouselProps {
  backdrops: string[];
  height?: number;
  autoScrollInterval?: number;
}

export function BackdropCarousel({
  backdrops,
  height = 280,
  autoScrollInterval = 5000,
}: BackdropCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const intervalRef = useRef<NodeJS.Timeout>();
  const [imageLoading, setImageLoading] = useState<{ [key: number]: boolean }>(
    {}
  );

  const { width: screenWidth } = Dimensions.get('window');

  // Auto-scroll logic
  useEffect(() => {
    if (backdrops.length <= 1) return;

    intervalRef.current = setInterval(() => {
      if (flatListRef.current) {
        const nextIndex = (currentIndex + 1) % backdrops.length;
        flatListRef.current.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
      }
    }, autoScrollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentIndex, backdrops.length, autoScrollInterval]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index ?? 0);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  if (!backdrops || backdrops.length === 0) {
    return null;
  }

  return (
    <View className="relative">
      <FlatList
        ref={flatListRef}
        data={backdrops}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => (
          <View style={{ width: screenWidth, height }} className="relative">
            <Image
              source={{ uri: item }}
              contentFit="cover"
              className="absolute inset-0"
              onLoadStart={() =>
                setImageLoading((prev) => ({ ...prev, [index]: true }))
              }
              onLoadEnd={() =>
                setImageLoading((prev) => ({ ...prev, [index]: false }))
              }
            />
            {imageLoading[index] && (
              <View className="absolute inset-0 items-center justify-center bg-black/20">
                <ActivityIndicator size="large" color="white" />
              </View>
            )}
            {/* Gradient overlay for better text readability */}
            <View className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
          </View>
        )}
        keyExtractor={(_, index) => index.toString()}
      />

      {/* Pagination dots */}
      {backdrops.length > 1 && (
        <View className="absolute inset-x-0 bottom-4 flex-row justify-center gap-2">
          {backdrops.map((_, index) => (
            <View
              key={index}
              className={`size-2 rounded-full ${
                index === currentIndex ? 'bg-white' : 'bg-white/40'
              }`}
            />
          ))}
        </View>
      )}
    </View>
  );
}
