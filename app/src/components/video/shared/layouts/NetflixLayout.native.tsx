import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { PlayerLayoutProps } from '../types/player.types';
import { useTheme } from '../themes/ThemeProvider';
import { ControlsBar } from '../components/ControlsBar';
import { TopBar } from '../components/TopBar';
import { LoadingOverlay } from '../components/LoadingOverlay';

export function NetflixLayout({
  videoElement,
  playerState,
  controls,
  title,
  showBack,
  onBack,
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

      {/* Top Bar with gradient */}
      {showControls && (
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'transparent']}
          style={[styles.topGradient, { padding: theme.dimensions.padding }]}
        >
          <TopBar
            title={title}
            showBack={showBack}
            onBack={onBack}
          />
        </LinearGradient>
      )}

      {/* Bottom Controls with gradient */}
      {showControls && (
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={[styles.bottomGradient, { padding: theme.dimensions.padding }]}
        >
          <ControlsBar
            playerState={playerState}
            controls={controls}
          />
        </LinearGradient>
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
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});