import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';

import { Pressable, Text, View } from '@/components/ui';

import { type FormatSupportInfo } from '../hooks/useFormatSupport';

interface FormatSupportIndicatorProps {
  formatInfo: FormatSupportInfo;
  onTrackSelect?: (type: 'audio' | 'subtitle', trackIndex: number) => void;
}

export function FormatSupportIndicator({
  formatInfo,
  onTrackSelect,
}: FormatSupportIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getSupportLevelColor = (level: string) => {
    switch (level) {
      case 'excellent':
        return 'text-green-400';
      case 'good':
        return 'text-blue-400';
      case 'limited':
        return 'text-yellow-400';
      case 'poor':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getSupportLevelIcon = (level: string) => {
    switch (level) {
      case 'excellent':
        return 'check-circle';
      case 'good':
        return 'info-circle';
      case 'limited':
        return 'warning';
      case 'poor':
        return 'error';
      default:
        return 'help';
    }
  };

  const handleTrackSelect = (
    type: 'audio' | 'subtitle',
    trackIndex: number
  ) => {
    onTrackSelect?.(type, trackIndex);
  };

  return (
    <View className="mb-3 rounded-lg bg-black/20 p-3">
      {/* Header with format info */}
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <FontAwesome5
            name="file-video"
            size={16}
            color="white"
            className="mr-2"
          />
          <Text className="font-medium text-white">
            {formatInfo.containerFormat.toUpperCase()}
          </Text>
          <View
            className={`ml-2 rounded-full px-2 py-1 ${getSupportLevelColor(formatInfo.supportLevel)}`}
          >
            <Text
              className={`text-xs font-semibold ${getSupportLevelColor(formatInfo.supportLevel)}`}
            >
              {formatInfo.supportLevel.toUpperCase()}
            </Text>
          </View>
        </View>

        <Pressable onPress={() => setShowDetails(!showDetails)} className="p-1">
          <MaterialIcons
            name={showDetails ? 'expand-less' : 'expand-more'}
            size={20}
            color="white"
          />
        </Pressable>
      </View>

      {/* Quick status indicators */}
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <MaterialIcons
            name="closed-caption"
            size={16}
            color={formatInfo.hasEmbeddedSubtitles ? '#22c55e' : '#6b7280'}
          />
          <Text className="ml-1 text-sm text-white">
            {`${formatInfo.subtitleTracks.length} subtitle${formatInfo.subtitleTracks.length !== 1 ? 's' : ''}`}
          </Text>
        </View>

        <View className="flex-row items-center">
          <MaterialIcons
            name="audiotrack"
            size={16}
            color={formatInfo.hasMultipleAudioTracks ? '#22c55e' : '#6b7280'}
          />
          <Text className="ml-1 text-sm text-white">
            {`${formatInfo.audioTracks.length} audio track${formatInfo.audioTracks.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
      </View>

      {/* Expandable details */}
      {showDetails && (
        <View className="border-t border-white/20 pt-3">
          {/* Support details */}
          <View className="mb-3">
            <Text className="mb-2 text-sm font-medium text-white">
              Format Support:
            </Text>
            <View className="rounded bg-black/30 p-2">
              <Text className="mb-1 text-xs text-white">
                📝 {formatInfo.supportDetails.subtitleSupport}
              </Text>
              <Text className="text-xs text-white">
                🔊 {formatInfo.supportDetails.audioSupport}
              </Text>
            </View>
          </View>

          {/* Available tracks */}
          {formatInfo.subtitleTracks.length > 0 && (
            <View className="mb-3">
              <Text className="mb-2 text-sm font-medium text-white">
                Subtitle Tracks:
              </Text>
              <View className="space-y-1">
                {formatInfo.subtitleTracks.map((track) => (
                  <Pressable
                    key={`sub-${track.index}`}
                    onPress={() => handleTrackSelect('subtitle', track.index)}
                    className="flex-row items-center justify-between rounded bg-white/10 p-2"
                  >
                    <View className="flex-1">
                      <Text className="text-xs text-white">
                        {track.languageName} ({track.format})
                      </Text>
                      {track.forced && (
                        <Text className="text-xs text-yellow-400">Forced</Text>
                      )}
                    </View>
                    <MaterialIcons name="play-arrow" size={16} color="white" />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {formatInfo.audioTracks.length > 0 && (
            <View className="mb-3">
              <Text className="mb-2 text-sm font-medium text-white">
                Audio Tracks:
              </Text>
              <View className="space-y-1">
                {formatInfo.audioTracks.map((track) => (
                  <Pressable
                    key={`audio-${track.index}`}
                    onPress={() => handleTrackSelect('audio', track.index)}
                    className="flex-row items-center justify-between rounded bg-white/10 p-2"
                  >
                    <View className="flex-1">
                      <Text className="text-xs text-white">
                        {track.languageName} ({track.codec})
                      </Text>
                      <Text className="text-xs text-gray-400">
                        {track.channels}ch
                      </Text>
                    </View>
                    <MaterialIcons name="play-arrow" size={16} color="white" />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Recommendations */}
          <View>
            <Text className="mb-2 text-sm font-medium text-white">
              Recommendations:
            </Text>
            <View className="space-y-1">
              {formatInfo.supportDetails.recommendations.map((rec, index) => (
                <Text key={index} className="text-xs text-gray-300">
                  {rec}
                </Text>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
