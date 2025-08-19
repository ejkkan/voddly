import React from 'react';
import { ScrollView, Text, View } from '@/components/ui';

type Item = {
  id: string | number;
  title: string;
  imageUrl: string;
};

type CarouselRowProps = {
  title: string;
  data: Item[];
  renderItem: (item: Item) => React.ReactElement;
};

export const CarouselRow = ({ title, data, renderItem }: CarouselRowProps) => {
  return (
    <View className="mb-4">
      <Text className="mb-2 px-2 text-lg font-semibold text-neutral-900 dark:text-white md:px-4 md:text-xl">
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8 }}
      >
        {data.map((item) => (
          <View key={String(item.id)}>{renderItem(item)}</View>
        ))}
      </ScrollView>
    </View>
  );
};

export default CarouselRow;
