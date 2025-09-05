import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ControlsBar } from '../components/ControlsBar';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { TopBar } from '../components/TopBar';
import { type PlayerLayoutProps } from '../types/player.types';

export function NetflixLayout({
  videoElement,
  playerState,
  controls,
  title,
  showBack,
  onBack,
  showControls,
  setShowControls,
  constrainToContainer = true,
}: PlayerLayoutProps) {

  return (
    <View style={styles.container}>
      {/* Video Element */}
      <Pressable
        style={styles.videoContainer}
        onPress={() => setShowControls(!showControls)}
      >
        {videoElement}
      </Pressable>

      {/* Bottom Controls and Info with gradient - Fixed to viewport */}
      {showControls && (
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={[
            styles.bottomGradient,
            {
              padding: 16,
              zIndex: 1000,
            },
          ]}
        >
          {/* Video Info at bottom */}
          <View style={{ marginBottom: 12 }}>
            <TopBar title={title} showBack={showBack} onBack={onBack} />
          </View>
          {/* Controls below the info */}
          <ControlsBar playerState={playerState} controls={controls} />
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
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
