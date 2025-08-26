import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '../themes/ThemeProvider';

export function LoadingOverlay() {
  const theme = useTheme();

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
    >
      <ActivityIndicator size="large" color={theme.colors.progress} />
    </View>
  );
}