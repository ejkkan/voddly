import React from 'react';

import { FlatList, Text, View } from '@/components/ui';

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
};

export const CarouselRow = ({
  title,
  data,
  renderItem,
  onEndReached,
  loadingMore,
}: CarouselRowProps) => {
  return (
    <View className="mb-4">
      <Text className="mb-2 px-2 text-lg font-semibold text-neutral-900 dark:text-white md:px-4 md:text-xl">
        {title}
      </Text>
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
