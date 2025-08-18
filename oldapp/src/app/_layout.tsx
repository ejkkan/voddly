// Import  global CSS file
import '../../global.css';

// @ts-ignore
import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Removed APIProvider – old API layer not used anymore
import { hydrateAuth, loadSelectedTheme } from '@/lib';
// Re-enable BottomSheet provider for components like Select/Modal
// @ts-ignore
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

// No keyboard provider needed - using standard React Native components
const KeyboardProvider = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

// ErrorBoundary export removed to avoid type issues in tooling

export const unstable_settings = {
  initialRouteName: '(app)',
};

hydrateAuth();
loadSelectedTheme();

export default function RootLayout() {
  return (
    <Providers>
      <Stack>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack>
    </Providers>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GestureHandlerRootView style={styles.container}>
      <KeyboardProvider>
        <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
        <FlashMessage position="top" />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
