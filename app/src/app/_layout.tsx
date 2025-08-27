// Import  global CSS file
import '../../global.css';

// Re-enable BottomSheet provider for components like Select/Modal
// @ts-ignore
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// @ts-ignore
import { Stack } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { ThemeProvider } from '@react-navigation/native';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { PassphraseProvider } from '@/components/passphrase/PassphraseProvider';
// Removed APIProvider – old API layer not used anymore
import { loadSelectedTheme } from '@/lib';
import { AppToasterHost } from '@/lib';
import { useThemeConfig } from '@/lib/use-theme-config';
import { DbProvider } from '@/lib/db/provider';

// Install atob shim as early as possible on web to handle URL-safe base64 and missing padding

// @ts-ignore
if (
  typeof window !== 'undefined' &&
  typeof (window as any).atob === 'function'
) {
  const originalAtob = (window as any).atob.bind(window);
  (window as any).__ORIGINAL_ATOB = originalAtob;
  const shim = (input: string) => {
    try {
      const g = globalThis as any;
      if (g && g.__BYPASS_ATOB_SHIM) {
        return originalAtob(input);
      }
    } catch {}
    const s = String(input || '')
      .replace(/\s+/g, '')
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
    const normalized = s + pad;
    return originalAtob(normalized);
  };
  (window as any).atob = shim;
  (globalThis as any).atob = shim;

  console.log('[polyfill] atob shim installed');
}

// ErrorBoundary export removed to avoid type issues in tooling

export const unstable_settings = {
  initialRouteName: 'index',
};

const queryClient = new QueryClient();
loadSelectedTheme();

export default function RootLayout() {
  React.useEffect(() => {
    // Web: patch atob to accept URL-safe base64 and missing padding
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const originalAtob =
        ((window as any).__ORIGINAL_ATOB ?? (window as any).atob)?.bind(
          window
        ) ?? null;
      const shim = (input: string) => {
        try {
          const g = globalThis as any;
          if (g && g.__BYPASS_ATOB_SHIM) {
            return originalAtob ? originalAtob(input) : input;
          }
        } catch {}
        const s = String(input || '')
          .replace(/\s+/g, '')
          .replace(/-/g, '+')
          .replace(/_/g, '/');
        const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
        const normalized = s + pad;
        if (originalAtob) return originalAtob(normalized);
        // Fallback: minimal decoder (unlikely to be used)
        return Buffer.from(normalized, 'base64').toString('binary');
      };
      (window as any).atob = shim;
      (globalThis as any).atob = shim;
    }
  }, []);
  return (
    <Providers>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="signin" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen
          name="passphrase-setup"
          options={{ headerShown: false }}
        />
      </Stack>
    </Providers>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  const theme = useThemeConfig();
  return (
    <GestureHandlerRootView
      style={styles.container}
      className={theme.dark ? 'dark' : undefined}
    >
      <KeyboardProvider>
        <ThemeProvider value={theme}>
          <QueryClientProvider client={queryClient}>
            <DbProvider>
              <PassphraseProvider>
                <BottomSheetModalProvider>
                  {children}
                  <AppToasterHost />
                </BottomSheetModalProvider>
              </PassphraseProvider>
            </DbProvider>
            <FlashMessage position="top" />
          </QueryClientProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
