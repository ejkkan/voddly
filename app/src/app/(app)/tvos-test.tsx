import React, { useState } from 'react';

import {
  Button,
  Checkbox,
  FocusAwareStatusBar,
  Text,
  View,
} from '@/components/ui';
import { isTV } from '@/lib/platform';

export default function TVOSTest() {
  const [count, setCount] = useState(0);
  const [isChecked, setIsChecked] = useState(false);

  if (!isTV) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <FocusAwareStatusBar />
        <Text className="text-xl text-center">
          This page is designed for tvOS testing.
          {'\n'}Please run this app on Apple TV to test focus navigation.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center items-center p-8 space-y-4">
      <FocusAwareStatusBar />

      <Text className="text-3xl font-bold text-center mb-8">
        tvOS Focus Test
      </Text>

      <Text className="text-xl text-center mb-4">
        Use the Apple TV remote to navigate between elements
      </Text>

      <View className="space-y-6 w-full max-w-md">
        <Button
          label={`Increment Count: ${count}`}
          onPress={() => setCount((c) => c + 1)}
          size="lg"
        />

        <Button
          label="Reset Count"
          onPress={() => setCount(0)}
          variant="outline"
          size="lg"
        />

        <View className="my-4">
          <Checkbox
            checked={isChecked}
            onChange={setIsChecked}
            accessibilityLabel="Test checkbox"
            label="Toggle this checkbox"
          />
        </View>

        <Button
          label="Destructive Action"
          variant="destructive"
          onPress={() => alert('Destructive action pressed!')}
          size="lg"
        />

        <Button
          label="Ghost Button"
          variant="ghost"
          onPress={() => alert('Ghost button pressed!')}
          size="lg"
        />
      </View>

      <Text className="text-center mt-8 text-gray-500">
        Navigate with Apple TV remote D-pad
        {'\n'}Press to select, Menu to go back
      </Text>
    </View>
  );
}
