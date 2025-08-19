// Import  global CSS file
import '../../global.css';

// Re-enable BottomSheet provider for components like Select/Modal
// @ts-ignore
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// @ts-ignore
import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

// Removed APIProvider – old API layer not used anymore
import { loadSelectedTheme } from '@/lib';
import { DbProvider } from '@/lib/db/provider';

// ErrorBoundary export removed to avoid type issues in tooling

export const unstable_settings = {
  initialRouteName: 'index',
};

const queryClient = new QueryClient();
loadSelectedTheme();

export default function RootLayout() {
  return (
    <Providers>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="signin" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack>
    </Providers>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GestureHandlerRootView style={styles.container}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <DbProvider>
            <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
          </DbProvider>
          <FlashMessage position="top" />
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
