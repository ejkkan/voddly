import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useTheme } from '../themes/ThemeProvider';

interface ProgressBarProps {
  progress: number;
  buffered?: number;
  onSeek: (fraction: number) => void;
  minimal?: boolean;
}

export function ProgressBar({ progress, buffered = 0, onSeek, minimal = false }: ProgressBarProps) {
  const theme = useTheme();
  const [barWidth, setBarWidth] = useState(0);

  const handlePress = (event: any) => {
    if (barWidth === 0) return;
    const locationX = event.nativeEvent.locationX;
    const fraction = locationX / barWidth;
    onSeek(Math.max(0, Math.min(1, fraction)));
  };

  const height = minimal ? 2 : theme.dimensions.progressBarHeight;

  return (
    <Pressable
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      onPress={handlePress}
      style={{
        width: '100%',
        height: height + 10, // Extra height for touch target
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          position: 'relative',
          width: '100%',
          height,
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: height / 2,
          overflow: 'hidden',
        }}
      >
        {/* Buffered progress */}
        {buffered > 0 && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${buffered}%`,
              backgroundColor: theme.colors.buffered,
            }}
          />
        )}
        
        {/* Playback progress */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${progress}%`,
            backgroundColor: theme.colors.progress,
          }}
        />
      </View>
    </Pressable>
  );
}