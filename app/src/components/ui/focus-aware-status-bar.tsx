import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Platform } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';

type Props = { hidden?: boolean };
export const FocusAwareStatusBar = ({ hidden = false }: Props) => {
  const { colorScheme } = useColorScheme();

  if (Platform.OS === 'web') return null;

  // For Expo Router, we don't need complex focus management - just show the status bar
  return (
    <SystemBars
      style={colorScheme === 'light' ? 'dark' : 'light'}
      hidden={hidden}
    />
  );
};
