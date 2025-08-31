/* eslint-disable */
import React from 'react';
import { Pressable, Text, View } from '@/components/ui';
import { Fontisto, AntDesign, MaterialIcons } from '@expo/vector-icons';

export type ControlsBarProps = {
  isPlaying: boolean;
  isLoading: boolean;
  hasError: boolean;
  currentTimeLabel: string;
  durationLabel: string;
  progressPercent: number;
  onSeekToFraction: (fraction01: number) => void;
  onSeekBack: () => void;
  onSeekForward: () => void;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  audioLanguages: string[];
  selectedAudioLanguage?: string;
  onCycleAudioLanguage: () => void;
  subsDisabled: boolean;
  subtitleLabel: string;
  onPressSubtitles: () => void;
  hasSubtitles: boolean;
  audioFixEnabled: boolean;
  audioFixAvailable: boolean;
  onPressAudioFix: () => void;
  onRetry: () => void;
  onToggleFullscreen: () => void;
  isFullscreen?: boolean;
  // New format support props
  formatInfo?: any;
  onPressAudioTracks?: () => void;
  hasMultipleAudioTracks?: boolean;
  hasEmbeddedSubtitles?: boolean;
};

export function ControlsBar(props: ControlsBarProps) {
  const {
    isPlaying,
    isLoading,
    hasError,
    currentTimeLabel,
    durationLabel,
    progressPercent,
    onSeekToFraction,
    onSeekBack,
    onSeekForward,
    onTogglePlay,
    onToggleMute,
    isMuted,
    audioLanguages,
    selectedAudioLanguage,
    onCycleAudioLanguage,
    subsDisabled,
    subtitleLabel,
    onPressSubtitles,
    hasSubtitles,
    audioFixEnabled,
    audioFixAvailable,
    onPressAudioFix,
    onRetry,
    onToggleFullscreen,
    isFullscreen,
    // New format support props
    formatInfo,
    onPressAudioTracks,
    hasMultipleAudioTracks,
    hasEmbeddedSubtitles,
  } = props;

  const barWidthRef = React.useRef(0);

  return (
    <>
      <View className="flex-row items-center justify-between mb-2">
        <Pressable
          className="rounded-md bg-white/10 px-4 py-3"
          onPress={onTogglePlay}
        >
          <Fontisto
            name={isPlaying ? 'pause' : 'play'}
            color="#fff"
            size={16}
          />
        </Pressable>

        <Pressable
          className="rounded-md bg-white/10 px-4 py-3"
          onPress={onToggleMute}
        >
          <Fontisto
            name={isMuted ? 'volume-off' : 'volume-up'}
            color="#fff"
            size={16}
          />
        </Pressable>

        {/* Enhanced Audio Track Selection */}
        {hasMultipleAudioTracks && onPressAudioTracks ? (
          <Pressable
            className="rounded-md bg-white/10 px-4 py-3"
            onPress={onPressAudioTracks}
          >
            <Fontisto name="music-note" color="#fff" size={16} />
          </Pressable>
        ) : audioLanguages.length > 0 ? (
          <Pressable
            className="rounded-md bg-white/10 px-4 py-3"
            onPress={onCycleAudioLanguage}
          >
            <Fontisto name="music-note" color="#fff" size={16} />
          </Pressable>
        ) : null}

        {audioFixEnabled && audioFixAvailable ? (
          <Pressable
            className="rounded-md bg-white/10 px-4 py-3"
            onPress={onPressAudioFix}
          >
            <Fontisto name="audio-description" color="#fff" size={16} />
          </Pressable>
        ) : null}

        {/* Enhanced Subtitle Selection */}
        {!subsDisabled && (hasSubtitles || hasEmbeddedSubtitles) ? (
          <Pressable
            className="rounded-md bg-white/10 px-4 py-3"
            onPress={onPressSubtitles}
          >
            <MaterialIcons name="closed-caption" color="#fff" size={18} />
          </Pressable>
        ) : null}

        <Pressable
          className="rounded-md bg-white/10 px-4 py-3"
          onPress={onToggleFullscreen}
        >
          <MaterialIcons
            name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'}
            color="#fff"
            size={18}
          />
        </Pressable>
      </View>

      <View className="flex-row items-center">
        <Text className="text-white text-xs mr-2" style={{ width: 48 }}>
          {currentTimeLabel}
        </Text>
        <Pressable
          style={{
            flex: 1,
            height: 8,
            backgroundColor: '#3f3f46',
            borderRadius: 2,
            overflow: 'hidden',
          }}
          onLayout={(e) => {
            try {
              barWidthRef.current = e.nativeEvent.layout.width;
            } catch {}
          }}
          onPressIn={(e) => {
            try {
              const x = (e as any).nativeEvent.locationX || 0;
              const width = Math.max(1, barWidthRef.current || 1);
              const frac = Math.max(0, Math.min(1, x / width));
              onSeekToFraction(frac);
            } catch {}
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              backgroundColor: '#22c55e',
            }}
          />
        </Pressable>
        <Text
          className="text-white text-xs ml-2"
          style={{ width: 48, textAlign: 'right' }}
        >
          {durationLabel}
        </Text>
      </View>

      <View className="flex-row items-center justify-between mt-2">
        <Pressable
          className="rounded-md bg-white/10 px-4 py-3"
          onPress={onSeekBack}
        >
          <Fontisto name="angle-left" color="#fff" size={16} />
        </Pressable>
        <Pressable
          className="rounded-md bg-white/10 px-4 py-3"
          onPress={onSeekForward}
        >
          <Fontisto name="angle-right" color="#fff" size={16} />
        </Pressable>
        {hasError ? (
          <Pressable
            className="rounded-md bg-white/10 px-4 py-3"
            onPress={onRetry}
          >
            <AntDesign name="reload1" color="#fff" size={16} />
          </Pressable>
        ) : null}
      </View>
    </>
  );
}
