import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { type Subtitle } from '@/hooks/useSubtitles';

interface SubtitleModalProps {
  visible: boolean;
  onClose: () => void;
  subtitles: Subtitle[];
  isLoading: boolean;
  onSubtitleSelect: (subtitle: Subtitle) => void;
}

export function SubtitleModal({
  visible,
  onClose,
  subtitles,
  isLoading,
  onSubtitleSelect,
}: SubtitleModalProps) {
  const handleSubtitleSelect = (subtitle: Subtitle) => {
    onSubtitleSelect(subtitle);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/50">
        <View className="max-h-96 w-80 rounded-lg bg-gray-900">
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-gray-800 p-4">
            <Text className="text-lg font-semibold text-white">
              Available Subtitles
            </Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <MaterialIcons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View className="flex-1">
            {isLoading ? (
              <View className="flex-1 items-center justify-center p-6">
                <Text className="text-gray-400">Loading subtitles...</Text>
              </View>
            ) : subtitles.length === 0 ? (
              <View className="flex-1 items-center justify-center p-6">
                <Text className="text-center text-gray-400">
                  No subtitles available
                </Text>
              </View>
            ) : (
              <ScrollView className="flex-1 p-2">
                {subtitles.map((subtitle) => (
                  <TouchableOpacity
                    key={subtitle.id}
                    onPress={() => handleSubtitleSelect(subtitle)}
                    className="mb-2 flex-row items-center justify-between rounded-lg bg-gray-800 p-3 active:bg-gray-700"
                  >
                    <View className="flex-1">
                      <Text className="font-medium text-white">
                        {subtitle.language_name}
                      </Text>
                      {subtitle.source && (
                        <Text className="mt-1 text-xs text-gray-400">
                          {subtitle.source}
                        </Text>
                      )}
                    </View>
                    <MaterialIcons name="play-arrow" size={20} color="white" />
                  </TouchableOpacity>
                ))}

                {/* Bottom spacing */}
                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
