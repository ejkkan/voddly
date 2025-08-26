import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons, Fontisto } from '@expo/vector-icons';
import { PlayerState, PlayerControls } from '../types/player.types';
import { useTheme } from '../themes/ThemeProvider';
import { PlayButton } from './PlayButton';
import { VolumeControl } from './VolumeControl';
import { ProgressBar } from './ProgressBar';
import { CastButton } from './CastButton';
import { formatTime } from '../utils/formatTime';

interface ControlsBarProps {
  playerState: PlayerState;
  controls: PlayerControls;
}

export function ControlsBar({ playerState, controls }: ControlsBarProps) {
  const theme = useTheme();

  const progressPercent = playerState.duration > 0 
    ? (playerState.currentTime / playerState.duration) * 100 
    : 0;

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={{ marginBottom: theme.dimensions.spacing }}>
        <ProgressBar
          progress={progressPercent}
          onSeek={(fraction) => controls.seek(fraction * playerState.duration)}
        />
      </View>

      {/* Controls Row */}
      <View style={styles.controlsRow}>
        {/* Left Controls */}
        <View style={[styles.leftControls, { gap: theme.dimensions.spacing }]}>
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
          <Text style={[
            styles.timeText,
            { 
              color: theme.colors.text, 
              fontSize: theme.dimensions.fontSize.small 
            }
          ]}>
            {formatTime(playerState.currentTime)} / {formatTime(playerState.duration)}
          </Text>
        </View>

        {/* Right Controls */}
        <View style={[styles.rightControls, { gap: theme.dimensions.spacing }]}>
          {/* Subtitle button */}
          {playerState.subtitleTracks.length > 0 && (
            <Pressable
              style={[
                styles.button,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.styles.buttonRadius,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }
              ]}
              onPress={() => {
                const tracks = playerState.subtitleTracks;
                const currentIndex = tracks.findIndex(t => t.id === playerState.selectedSubtitleTrack);
                const nextIndex = (currentIndex + 1) % (tracks.length + 1);
                controls.selectSubtitleTrack(nextIndex < tracks.length ? tracks[nextIndex].id : '');
              }}
            >
              <MaterialIcons name="closed-caption" size={theme.dimensions.iconSize} color={theme.colors.text} />
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
                backgroundColor: theme.colors.surface,
                borderRadius: theme.styles.buttonRadius,
                width: theme.dimensions.controlButton,
                height: theme.dimensions.controlButton,
              }
            ]}
            onPress={controls.toggleFullscreen}
          >
            <MaterialIcons name="fullscreen" size={theme.dimensions.iconSize} color={theme.colors.text} />
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