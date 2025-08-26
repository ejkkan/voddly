import { Redirect, SplashScreen, Stack } from 'expo-router';
import React, { useCallback, useEffect } from 'react';

import { AppShell } from '@/components/navigation/app-shell';
import { useIsFirstTime } from '@/lib';
import { useSession } from '@/lib/auth/hooks';

export const unstable_settings = {
  initialRouteName: 'dashboard',
};

export default function ProtectedLayout() {
  const { data: session, isLoading } = useSession();
  const [isFirstTime] = useIsFirstTime();

  const hideSplash = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => {
        hideSplash();
      }, 300);
    }
  }, [hideSplash, isLoading]);

  // Handle first-time users
  if (isFirstTime) {
    return <Redirect href="/onboarding" />;
  }

  // Only redirect if we're sure the user is not logged in
  // The root index will handle encryption checks
  if (!isLoading && !session?.data?.user) {
    return <Redirect href="/" />;
  }

  // Show nothing while loading to prevent flashing
  if (isLoading) {
    return null;
  }

  return (
    <AppShell>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="search" />
        <Stack.Screen name="movies" />
        <Stack.Screen name="player" />
        <Stack.Screen name="series" />
        <Stack.Screen name="live" />
        <Stack.Screen name="playlists" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="test" />
      </Stack>
    </AppShell>
  );
}
