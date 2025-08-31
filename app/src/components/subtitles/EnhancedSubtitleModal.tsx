import { FontAwesome5 } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { type FormatSupportInfo } from '@/components/video/web-player/hooks/useFormatSupport';
import { type Subtitle } from '@/hooks/useSubtitles';

interface EnhancedSubtitleModalProps {
  visible: boolean;
  onClose: () => void;
  subtitles: Subtitle[];
  formatInfo: FormatSupportInfo | null;
  isLoading: boolean;
  onSubtitleSelect: (subtitle: Subtitle) => void;
  onEmbeddedTrackSelect?: (trackIndex: number) => void;
}

export function EnhancedSubtitleModal({
  visible,
  onClose,
  subtitles,
  formatInfo,
  isLoading,
  onSubtitleSelect,
  onEmbeddedTrackSelect,
}: EnhancedSubtitleModalProps) {
  const [activeTab, setActiveTab] = useState<'external' | 'embedded'>(
    'external'
  );

  const handleSubtitleSelect = (subtitle: Subtitle) => {
    onSubtitleSelect(subtitle);
    onClose();
  };

  const handleEmbeddedTrackSelect = (trackIndex: number) => {
    onEmbeddedTrackSelect?.(trackIndex);
    onClose();
  };

  const hasEmbeddedSubtitles =
    formatInfo?.hasEmbeddedSubtitles && formatInfo.subtitleTracks.length > 0;
  const hasExternalSubtitles = subtitles.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/50">
        <View className="max-h-96 w-96 rounded-lg bg-gray-900">
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-gray-800 p-4">
            <Text className="text-lg font-semibold text-white">
              Subtitle Options
            </Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <MaterialIcons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Format Info Bar */}
          {formatInfo && (
            <View className="border-b border-gray-700 bg-gray-800 p-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <FontAwesome5
                    name="file-video"
                    size={14}
                    color="white"
                    className="mr-2"
                  />
                  <Text className="text-sm text-white">
                    {formatInfo.containerFormat.toUpperCase()}
                  </Text>
                  <View
                    className={`ml-2 rounded-full px-2 py-1 ${
                      formatInfo.supportLevel === 'excellent'
                        ? 'bg-green-600'
                        : formatInfo.supportLevel === 'good'
                          ? 'bg-blue-600'
                          : formatInfo.supportLevel === 'limited'
                            ? 'bg-yellow-600'
                            : 'bg-red-600'
                    }`}
                  >
                    <Text className="text-xs font-semibold text-white">
                      {formatInfo.supportLevel.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text className="text-xs text-gray-400">
                  {formatInfo.subtitleTracks.length} embedded,{' '}
                  {subtitles.length} external
                </Text>
              </View>
            </View>
          )}

          {/* Tab Navigation */}
          {(hasEmbeddedSubtitles || hasExternalSubtitles) && (
            <View className="flex-row border-b border-gray-700">
              {hasExternalSubtitles && (
                <TouchableOpacity
                  onPress={() => setActiveTab('external')}
                  className={`flex-1 px-4 py-3 ${
                    activeTab === 'external' ? 'border-b-2 border-blue-500' : ''
                  }`}
                >
                  <Text
                    className={`text-center ${
                      activeTab === 'external'
                        ? 'text-blue-400'
                        : 'text-gray-400'
                    }`}
                  >
                    External Subtitles
                  </Text>
                </TouchableOpacity>
              )}
              {hasEmbeddedSubtitles && (
                <TouchableOpacity
                  onPress={() => setActiveTab('embedded')}
                  className={`flex-1 px-4 py-3 ${
                    activeTab === 'embedded' ? 'border-b-2 border-blue-500' : ''
                  }`}
                >
                  <Text
                    className={`text-center ${
                      activeTab === 'embedded'
                        ? 'text-blue-400'
                        : 'text-gray-400'
                    }`}
                  >
                    Embedded Tracks
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Content */}
          <View className="flex-1">
            {isLoading ? (
              <View className="flex-1 items-center justify-center p-6">
                <Text className="text-gray-400">
                  Analyzing subtitle options...
                </Text>
              </View>
            ) : !hasEmbeddedSubtitles && !hasExternalSubtitles ? (
              <View className="flex-1 items-center justify-center p-6">
                <MaterialIcons
                  name="closed-caption-off"
                  size={48}
                  color="#6b7280"
                />
                <Text className="mt-2 text-center text-gray-400">
                  No subtitles available
                </Text>
                {formatInfo && (
                  <Text className="mt-1 text-center text-xs text-gray-500">
                    {formatInfo.containerFormat.toUpperCase()} format has
                    limited subtitle support
                  </Text>
                )}
              </View>
            ) : (
              <ScrollView className="flex-1 p-4">
                {activeTab === 'external' && hasExternalSubtitles && (
                  <View>
                    <Text className="mb-3 font-medium text-white">
                      External Subtitle Files
                    </Text>
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
                              Source: {subtitle.source}
                            </Text>
                          )}
                        </View>
                        <MaterialIcons
                          name="play-arrow"
                          size={20}
                          color="white"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {activeTab === 'embedded' &&
                  hasEmbeddedSubtitles &&
                  formatInfo && (
                    <View>
                      <Text className="mb-3 font-medium text-white">
                        Embedded Subtitle Tracks
                      </Text>
                      <Text className="mb-3 text-xs text-gray-400">
                        These subtitles are built into the video file
                      </Text>
                      {formatInfo.subtitleTracks.map((track) => (
                        <TouchableOpacity
                          key={`embedded-${track.index}`}
                          onPress={() => handleEmbeddedTrackSelect(track.index)}
                          className="mb-2 flex-row items-center justify-between rounded-lg bg-gray-800 p-3 active:bg-gray-700"
                        >
                          <View className="flex-1">
                            <View className="flex-row items-center">
                              <Text className="font-medium text-white">
                                {track.languageName}
                              </Text>
                              {track.forced && (
                                <View className="ml-2 rounded bg-yellow-600 px-2 py-1">
                                  <Text className="text-xs font-semibold text-yellow-900">
                                    FORCED
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text className="mt-1 text-xs text-gray-400">
                              Format: {track.format} | Codec: {track.codec}
                            </Text>
                          </View>
                          <MaterialIcons
                            name="play-arrow"
                            size={20}
                            color="white"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                {/* Bottom spacing */}
                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>

          {/* Footer with format recommendations */}
          {formatInfo && formatInfo.supportLevel !== 'excellent' && (
            <View className="border-t border-gray-700 bg-gray-800 p-3">
              <Text className="text-center text-xs text-gray-400">
                💡 {formatInfo.supportDetails.recommendations[0]}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
