import { Fontisto } from '@expo/vector-icons';
import React from 'react';
import { Pressable } from 'react-native';

import { useTheme } from '../themes/ThemeProvider';

interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
}

export function VolumeControl({
  volume,
  isMuted,
  onToggleMute,
}: VolumeControlProps) {
  const theme = useTheme();

  // On mobile, we typically use system volume, so we just show mute toggle
  const iconName =
    isMuted || volume === 0
      ? 'volume-off'
      : volume < 0.5
        ? 'volume-down'
        : 'volume-up';

  return (
    <Pressable
      onPress={onToggleMute}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.surface,
        borderRadius: theme.styles.buttonRadius,
        width: theme.dimensions.controlButton,
        height: theme.dimensions.controlButton,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 1 : theme.styles.buttonOpacity,
      })}
    >
      <Fontisto
        name={iconName}
        size={theme.dimensions.iconSize}
        color={theme.colors.text}
      />
    </Pressable>
  );
}
