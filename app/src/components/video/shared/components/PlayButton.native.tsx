import { Fontisto } from '@expo/vector-icons';
import React from 'react';
import { Pressable } from 'react-native';

import { useTheme } from '../themes/ThemeProvider';

interface PlayButtonProps {
  isPlaying: boolean;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
}

export function PlayButton({
  isPlaying,
  onPress,
  size = 'medium',
}: PlayButtonProps) {
  const theme = useTheme();

  const sizeMap = {
    small: theme.dimensions.controlButton * 0.8,
    medium: theme.dimensions.controlButton,
    large: theme.dimensions.controlButton * 1.5,
  };

  const iconSizeMap = {
    small: theme.dimensions.iconSize * 0.8,
    medium: theme.dimensions.iconSize,
    large: theme.dimensions.iconSize * 1.5,
  };

  const buttonSize = sizeMap[size];
  const iconSize = iconSizeMap[size];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.surface,
        borderRadius: theme.styles.buttonRadius,
        width: buttonSize,
        height: buttonSize,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 1 : theme.styles.buttonOpacity,
      })}
    >
      <Fontisto
        name={isPlaying ? 'pause' : 'play'}
        size={iconSize}
        color={theme.colors.text}
      />
    </Pressable>
  );
}
