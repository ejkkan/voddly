import React, { useMemo } from 'react';
import { FlatList, Dimensions } from 'react-native';
import { View, Text, Image, Pressable } from '@/components/ui';
import { isTV, isWeb } from '@/lib/platform';

type CarouselItem = {
  id: string;
  title: string;
  poster: string;
  subtitle?: string;
  rating?: string | number;
};

export function HorizontalCarousel({
  title,
  items,
  onPressItem,
}: {
  title: string;
  items: CarouselItem[];
  onPressItem: (id: string) => void;
}) {
  const itemSizeClass = useMemo(() => {
    if (isTV) return 'w-52 h-80';
    if (isWeb) return 'w-44 h-66';
    return 'w-40 h-60';
  }, []);

  return (
    <View className="mb-6">
      <Text
        className={`${isTV ? 'text-2xl' : 'text-xl'} mb-3 font-semibold text-white`}
      >
        {title}
      </Text>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => onPressItem(item.id)} className="mr-3">
            <View
              className={`${itemSizeClass} overflow-hidden rounded-xl bg-gray-800`}
            >
              <Image
                source={{ uri: item.poster }}
                className="h-4/5 w-full"
                resizeMode="cover"
              />
              <View className="flex-1 justify-center p-2">
                <Text
                  className={`${isTV ? 'text-base' : 'text-sm'} font-medium text-white`}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <View className="flex-row items-center justify-between">
                  {item.subtitle ? (
                    <Text
                      className={`${isTV ? 'text-xs' : 'text-[11px]'} text-gray-300`}
                    >
                      {item.subtitle}
                    </Text>
                  ) : (
                    <View />
                  )}
                  {item.rating ? (
                    <Text
                      className={`${isTV ? 'text-xs' : 'text-[11px]'} text-yellow-400`}
                    >
                      ⭐ {item.rating}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
