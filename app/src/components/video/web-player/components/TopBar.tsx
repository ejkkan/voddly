/* eslint-disable */
import React from 'react';
import { Pressable, Text, View } from '@/components/ui';

export function TopBar({
  showBack,
  onBack,
  title,
}: {
  showBack?: boolean;
  onBack?: () => void;
  title?: string;
}) {
  return (
    <View className="flex-row items-center p-3">
      {showBack ? (
        <Pressable
          className="rounded-md bg-white/10 px-3 py-2 mr-2"
          onPress={onBack}
        >
          <Text className="text-white">Back</Text>
        </Pressable>
      ) : null}
      {title ? (
        <Text className="text-white text-sm" numberOfLines={1}>
          {title}
        </Text>
      ) : null}
    </View>
  );
}
