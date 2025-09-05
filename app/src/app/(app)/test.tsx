import React from 'react';
import { View, Text } from '@/components/ui';

export default function TestPage() {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="text-xl font-bold">Test Page</Text>
      <Text className="text-center text-neutral-600 dark:text-neutral-400 mt-4">
        This is a test page for development purposes.
      </Text>
    </View>
  );
}
