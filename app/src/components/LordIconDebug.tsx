import React from 'react';
import { View, Text } from '@/components/ui';
import notificationIcon from '@/assets/lordicons/notification.js';

/**
 * Debug component to test Lordicon asset loading
 */
export function LordIconDebug() {
  const iconData = notificationIcon;
  console.log(
    'Lordicon data loaded:',
    iconData ? 'SUCCESS' : 'FAILED',
    iconData
  );

  return (
    <View className="p-4 bg-gray-800 rounded-lg">
      <Text className="text-white font-bold mb-2">Lordicon Debug</Text>
      <Text className="text-gray-300 text-sm">
        Icon Data: {iconData ? 'Loaded ✅' : 'Failed ❌'}
      </Text>
      {iconData && (
        <Text className="text-green-400 text-sm mt-2">
          Icon name: {iconData.nm || 'Unknown'}
        </Text>
      )}
    </View>
  );
}
