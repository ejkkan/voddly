import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type PlayerControls, type PlayerState } from '../types/player.types';
import { formatTime } from '../utils/formatTime';
import { CastButton } from './CastButton';
import { PlayButton } from './PlayButton';
import { ProgressBar } from './ProgressBar';
import { VolumeControl } from './VolumeControl';

interface ControlsBarProps {
  playerState: PlayerState;
  controls: PlayerControls;
}

export function ControlsBar({ playerState, controls }: ControlsBarProps) {

  const progressPercent =
    playerState.duration > 0
      ? (playerState.currentTime / playerState.duration) * 100
      : 0;

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={{ marginBottom: 12 }}>
        <ProgressBar
          progress={progressPercent}
          onSeek={(fraction) => controls.seek(fraction * playerState.duration)}
        />
      </View>

      {/* Controls Row */}
      <View style={styles.controlsRow}>
        {/* Left Controls */}
        <View style={[styles.leftControls, { gap: 12 }]}>
          <PlayButton
            isPlaying={playerState.isPlaying}
            onPress={controls.togglePlay}
          />
          <VolumeControl
            volume={playerState.volume}
            isMuted={playerState.isMuted}
            onVolumeChange={controls.setVolume}
            onToggleMute={controls.toggleMute}
          />
          <Text
            style={[
              styles.timeText,
              {
                color: '#ffffff',
                fontSize: 14,
              },
            ]}
          >
            {formatTime(playerState.currentTime)} /{' '}
            {formatTime(playerState.duration)}
          </Text>
        </View>

        {/* Right Controls */}
        <View style={[styles.rightControls, { gap: 12 }]}>
          {/* Subtitle button */}
          {playerState.subtitleTracks.length > 0 && (
            <Pressable
              style={[
                styles.button,
                {
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                },
              ]}
              onPress={() => {
                const tracks = playerState.subtitleTracks;
                const currentIndex = tracks.findIndex(
                  (t) => t.id === playerState.selectedSubtitleTrack
                );
                const nextIndex = (currentIndex + 1) % (tracks.length + 1);
                controls.selectSubtitleTrack(
                  nextIndex < tracks.length ? tracks[nextIndex].id : ''
                );
              }}
            >
              <MaterialIcons
                name="closed-caption"
                size={20}
                color="#ffffff"
              />
            </Pressable>
          )}

          {/* Cast button */}
          {playerState.castState && (
            <CastButton
              castState={playerState.castState}
              onPress={() => {
                if (playerState.isCasting) {
                  controls.stopCast?.();
                } else {
                  controls.startCast?.();
                }
              }}
            />
          )}

          {/* Fullscreen button */}
          <Pressable
            style={[
              styles.button,
              {
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 6,
                width: 40,
                height: 40,
              },
            ]}
            onPress={controls.toggleFullscreen}
          >
            <MaterialIcons
              name="fullscreen"
              size={20}
              color="#ffffff"
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    marginLeft: 8,
  },
});
