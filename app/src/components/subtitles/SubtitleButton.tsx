import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

interface SubtitleButtonProps {
  onPress: () => void;
  availableCount?: number;
  isLoading?: boolean;
  className?: string;
}

export function SubtitleButton({
  onPress,
  availableCount = 0,
  isLoading = false,
  className = '',
}: SubtitleButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center justify-center rounded-lg bg-black/70 p-4 ${className}`}
      disabled={isLoading}
    >
      <MaterialIcons name="subtitles" size={24} color="white" />
      <Text className="ml-2 font-medium text-white">Subtitles</Text>
      {availableCount > 0 && (
        <View className="ml-2 min-w-[24px] items-center rounded-full bg-blue-600 px-2 py-1">
          <Text className="text-xs font-medium text-white">
            {availableCount}
          </Text>
        </View>
      )}
      {isLoading && (
        <View className="ml-2">
          <Text className="text-xs text-gray-400">Loading...</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
