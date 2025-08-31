import React from 'react';

import { FlatList, Pressable, Text, View } from '@/components/ui';
import { ArrowRight } from '@/components/ui/icons';

type Item = {
  id: string | number;
  title: string;
  imageUrl?: string | null;
};

type CarouselRowProps = {
  title: string;
  data: Item[];
  renderItem: (item: Item) => React.ReactElement;
  onEndReached?: () => void;
  loadingMore?: boolean;
  titleAccessory?: React.ReactNode;
  onViewAll?: () => void;
};

export const CarouselRow = ({
  title,
  data,
  renderItem,
  onEndReached,
  loadingMore,
  titleAccessory,
  onViewAll,
}: CarouselRowProps) => {
  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center px-2 md:px-4">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-white md:text-xl">
          {title}
        </Text>
        {titleAccessory ? <View className="ml-2">{titleAccessory}</View> : null}
        {onViewAll ? (
          <Pressable onPress={onViewAll} className="ml-2 rounded-full p-1">
            <ArrowRight color="#6b7280" />
          </Pressable>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={data}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <View>{renderItem(item)}</View>}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8 }}
        onEndReachedThreshold={0.6}
        onEndReached={onEndReached}
        ListFooterComponent={
          loadingMore ? <View style={{ width: 24 }} /> : null
        }
      />
    </View>
  );
};

export default CarouselRow;
