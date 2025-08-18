import React from 'react';

import { Button, FocusAwareStatusBar, Text, View } from '@/components/ui';

export default function PlatformDemo() {
  return (
    <View className="flex-1 justify-center items-center p-8">
      <FocusAwareStatusBar />

      <Text className="text-3xl font-bold text-center mb-8">
        Platform-Specific Files Demo
      </Text>

      <Text className="text-lg text-center mb-8">
        This demonstrates how Metro resolves platform-specific files:
        {'\n\n'}
        On tvOS: Button.tvos.tsx is used
        {'\n'}
        On iOS/Android: Button.tsx is used
      </Text>

      <View className="space-y-4">
        <Button
          label="Platform-Specific Button"
          onPress={() =>
            alert('This button comes from the platform-specific file!')
          }
          size="lg"
        />

        <Text className="text-center text-gray-600">
          Check the console/logs to see which file was loaded
        </Text>
      </View>
    </View>
  );
}
