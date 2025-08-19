/* eslint-disable react/no-unstable-nested-components */
import React, { useCallback, useEffect } from 'react';
import { Redirect, SplashScreen, Stack } from 'expo-router';
import { useIsFirstTime } from '@/lib';
import { useSession } from '@/lib/auth/hooks';
import { AppShell } from '@/components/navigation/app-shell';

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

  if (isFirstTime) {
    return <Redirect href="/onboarding" />;
  }
  if (!isLoading && !session?.data?.user) {
    return <Redirect href="/signin" />;
  }

  return (
    <AppShell>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="movies" />
        <Stack.Screen name="player" />
        <Stack.Screen name="series" />
        <Stack.Screen name="live" />
        <Stack.Screen name="playlists" />
        <Stack.Screen name="settings" />
      </Stack>
    </AppShell>
  );
}
