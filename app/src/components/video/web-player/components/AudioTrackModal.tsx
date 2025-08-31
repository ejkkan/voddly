import { FontAwesome5 } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { type FormatSupportInfo } from '../hooks/useFormatSupport';

interface AudioTrackModalProps {
  visible: boolean;
  onClose: () => void;
  formatInfo: FormatSupportInfo | null;
  onAudioTrackSelect?: (trackIndex: number) => void;
}

export function AudioTrackModal({
  visible,
  onClose,
  formatInfo,
  onAudioTrackSelect,
}: AudioTrackModalProps) {
  const handleAudioTrackSelect = (trackIndex: number) => {
    onAudioTrackSelect?.(trackIndex);
    onClose();
  };

  const hasAudioTracks =
    formatInfo?.audioTracks && formatInfo.audioTracks.length > 0;

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
              Audio Track Selection
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
                  {formatInfo.audioTracks.length} audio track
                  {formatInfo.audioTracks.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}

          {/* Content */}
          <View className="flex-1">
            {!hasAudioTracks ? (
              <View className="flex-1 items-center justify-center p-6">
                <MaterialIcons name="audiotrack" size={48} color="#6b7280" />
                <Text className="mt-2 text-center text-gray-400">
                  No audio tracks available
                </Text>
                {formatInfo && (
                  <Text className="mt-1 text-center text-xs text-gray-500">
                    {formatInfo.containerFormat.toUpperCase()} format has
                    limited audio track support
                  </Text>
                )}
              </View>
            ) : (
              <ScrollView className="flex-1 p-4">
                <Text className="mb-3 font-medium text-white">
                  Available Audio Tracks
                </Text>

                {formatInfo?.audioTracks.map((track) => (
                  <TouchableOpacity
                    key={`audio-${track.index}`}
                    onPress={() => handleAudioTrackSelect(track.index)}
                    className="mb-3 flex-row items-center justify-between rounded-lg bg-gray-800 p-3 active:bg-gray-700"
                  >
                    <View className="flex-1">
                      <View className="mb-1 flex-row items-center">
                        <Text className="text-lg font-medium text-white">
                          {track.languageName}
                        </Text>
                        {track.default && (
                          <View className="ml-2 rounded bg-blue-600 px-2 py-1">
                            <Text className="text-xs font-semibold text-white">
                              DEFAULT
                            </Text>
                          </View>
                        )}
                      </View>

                      <View className="flex-row items-center space-x-4">
                        <View className="flex-row items-center">
                          <MaterialIcons
                            name="code"
                            size={14}
                            color="#9ca3af"
                          />
                          <Text className="ml-1 text-xs text-gray-400">
                            {track.codec.toUpperCase()}
                          </Text>
                        </View>

                        <View className="flex-row items-center">
                          <MaterialIcons
                            name="surround-sound"
                            size={14}
                            color="#9ca3af"
                          />
                          <Text className="ml-1 text-xs text-gray-400">
                            {track.channels}ch
                          </Text>
                        </View>
                      </View>

                      {track.title && (
                        <Text className="mt-1 text-xs text-gray-300">
                          {track.title}
                        </Text>
                      )}
                    </View>

                    <View className="items-end">
                      <MaterialIcons
                        name="play-arrow"
                        size={24}
                        color="white"
                      />
                      <Text className="mt-1 text-xs text-gray-400">
                        Track {track.index}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {/* Audio Quality Information */}
                <View className="mt-4 rounded-lg bg-gray-800 p-3">
                  <Text className="mb-2 font-medium text-white">
                    Audio Quality Info
                  </Text>
                  <View className="space-y-1">
                    <Text className="text-xs text-gray-300">
                      • <Text className="text-blue-400">AAC</Text>: High
                      quality, widely compatible
                    </Text>
                    <Text className="text-xs text-gray-300">
                      • <Text className="text-blue-400">MP3</Text>: Good
                      quality, universal support
                    </Text>
                    <Text className="text-xs text-gray-300">
                      • <Text className="text-blue-400">AC3</Text>: Surround
                      sound, high bitrate
                    </Text>
                    <Text className="text-xs text-gray-300">
                      • <Text className="text-blue-400">DTS</Text>: Premium
                      surround, high quality
                    </Text>
                    <Text className="text-xs text-gray-300">
                      • <Text className="text-blue-400">2ch</Text>: Stereo audio
                    </Text>
                    <Text className="text-xs text-gray-300">
                      • <Text className="text-blue-400">6ch</Text>: 5.1 surround
                      sound
                    </Text>
                  </View>
                </View>

                {/* Bottom spacing */}
                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>

          {/* Footer with format recommendations */}
          {formatInfo && formatInfo.supportLevel !== 'excellent' && (
            <View className="border-t border-gray-700 bg-gray-800 p-3">
              <Text className="text-center text-xs text-gray-400">
                💡{' '}
                {formatInfo.supportDetails.recommendations.find(
                  (r) => r.includes('audio') || r.includes('Audio')
                ) || formatInfo.supportDetails.recommendations[0]}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
