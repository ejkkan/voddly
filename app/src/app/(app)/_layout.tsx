import { Redirect, SplashScreen, Stack, usePathname } from 'expo-router';
import React, { useCallback, useEffect } from 'react';

import { AppShell } from '@/components/navigation/app-shell';
import { ProfileGuard } from '@/components/navigation/ProfileGuard';
import { useDeviceAutoRegister } from '@/hooks/useDeviceAutoRegister';
import { useIsFirstTime } from '@/lib';
import { useSession } from '@/lib/auth/hooks';

export const unstable_settings = {
  initialRouteName: 'dashboard',
};

export default function ProtectedLayout() {
  const { data: session, isLoading } = useSession();
  const [isFirstTime] = useIsFirstTime();
  const pathname = usePathname();

  // Monitor and handle device auto-registration
  useDeviceAutoRegister();

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

  // Check if we're on the profile picker route
  const isProfilePicker = pathname === '/(app)/profile-picker' || pathname === '/profile-picker';

  // Wrap with ProfileGuard and conditionally show AppShell
  return (
    <ProfileGuard>
      {isProfilePicker ? (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="profile-picker" />
        </Stack>
      ) : (
        <AppShell>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="dashboard" />
            <Stack.Screen name="search" />
            <Stack.Screen name="movies" />
            <Stack.Screen name="player" />
            <Stack.Screen name="series" />
            <Stack.Screen name="tv" />
            <Stack.Screen name="playlists" />
            <Stack.Screen name="profiles" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="test" />
            <Stack.Screen name="favorites" />
            <Stack.Screen name="sources" />
            <Stack.Screen name="category" />
          </Stack>
        </AppShell>
      )}
    </ProfileGuard>
  );
}
