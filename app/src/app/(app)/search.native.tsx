import React from 'react';
import { SafeAreaView, Text, View } from '@/components/ui';

export default function Search() {
  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <Text className="text-neutral-700 dark:text-neutral-200">
          Search coming soon on mobile.
        </Text>
      </View>
    </SafeAreaView>
  );
}
