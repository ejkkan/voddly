import React from 'react';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../themes/ThemeProvider';
import { CastState } from '../types/player.types';

interface CastButtonProps {
  castState: CastState;
  onPress: () => void;
}

export function CastButton({ castState, onPress }: CastButtonProps) {
  const theme = useTheme();

  if (castState === 'NO_DEVICES_AVAILABLE') {
    return null;
  }

  const getIconColor = () => {
    switch (castState) {
      case 'CONNECTED':
        return theme.colors.progress; // Green when connected
      case 'CONNECTING':
        return theme.colors.textSecondary; // Gray when connecting
      default:
        return theme.colors.text; // White when available
    }
  };

  const getIconName = () => {
    switch (castState) {
      case 'CONNECTED':
        return 'cast-connected';
      case 'CONNECTING':
        return 'cast';
      default:
        return 'cast';
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.surface,
        borderRadius: theme.styles.buttonRadius,
        width: theme.dimensions.controlButton,
        height: theme.dimensions.controlButton,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 1 : theme.styles.buttonOpacity,
        position: 'relative',
      })}
    >
      <MaterialCommunityIcons
        name={getIconName()}
        size={theme.dimensions.iconSize}
        color={getIconColor()}
      />
      
      {/* Connected indicator dot */}
      {castState === 'CONNECTED' && (
        <View
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.colors.progress,
          }}
        />
      )}
    </Pressable>
  );
}