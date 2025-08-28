import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LoadingOverlay } from '../components/LoadingOverlay';
import { PlayButton } from '../components/PlayButton';
import { ProgressBar } from '../components/ProgressBar';
import { useTheme } from '../themes/ThemeProvider';
import { type PlayerLayoutProps } from '../types/player.types';

export function MinimalLayout({
  videoElement,
  playerState,
  controls,
  showControls,
  setShowControls,
}: PlayerLayoutProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {/* Video Element */}
      <Pressable
        style={styles.videoContainer}
        onPress={() => setShowControls(!showControls)}
      >
        {videoElement}
      </Pressable>

      {/* Minimal progress bar always visible at bottom */}
      <View style={styles.progressContainer}>
        <ProgressBar
          progress={(playerState.currentTime / playerState.duration) * 100}
          onSeek={(fraction) => controls.seek(fraction * playerState.duration)}
          minimal
        />
      </View>

      {/* Center play/pause button when controls shown */}
      {showControls && (
        <View
          style={[
            styles.centerButton,
            {
              padding: theme.dimensions.padding,
              borderRadius: 50,
            },
          ]}
        >
          <PlayButton
            isPlaying={playerState.isPlaying}
            onPress={controls.togglePlay}
            size="large"
          />
        </View>
      )}

      {/* Loading Overlay */}
      {playerState.isLoading && <LoadingOverlay />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 2,
  },
  centerButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
});
