import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { Text, View } from '@/components/ui';
import { useCurrentProfile } from '@/hooks/ui/useCurrentProfile';

interface ProfileGuardProps {
  children: React.ReactNode;
}

export function ProfileGuard({ children }: ProfileGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentProfile, isLoading, profileId, profiles } =
    useCurrentProfile();
  const [isChecking, setIsChecking] = useState(true);

  // Don't guard the profile-picker route itself
  const isProfilePickerRoute =
    pathname === '/(app)/profile-picker' || pathname === '/profile-picker';

  useEffect(() => {
    // Skip guard check for profile picker route
    if (isProfilePickerRoute) {
      setIsChecking(false);
      return;
    }

    // Wait a moment to ensure profile store is initialized
    const checkProfile = async () => {
      // Give the store a moment to hydrate from local storage
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (!isLoading) {
        // Check different scenarios:
        // 1. No profiles at all - redirect to picker to create one
        // 2. Multiple profiles but none selected - redirect to picker
        // 3. Single profile - will be auto-selected by useCurrentProfile
        // 4. Profile selected - allow access

        if (profiles.length === 0) {
          // No profiles exist, need to create one
          router.replace('/(app)/profile-picker');
        } else if (profiles.length > 1 && !profileId) {
          // Multiple profiles but none selected, need to pick
          router.replace('/(app)/profile-picker');
        } else if (profiles.length === 1 || profileId) {
          // Either single profile (will auto-select) or profile already selected
          setIsChecking(false);
        }
      }
    };

    checkProfile();
  }, [
    currentProfile,
    profileId,
    profiles,
    isLoading,
    router,
    isProfilePickerRoute,
  ]);

  // For profile picker route, always render
  if (isProfilePickerRoute) {
    return <>{children}</>;
  }

  // Show loading state while checking for profile
  if (isLoading || isChecking) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-950">
        <Text className="text-lg text-neutral-600 dark:text-neutral-400">
          Loading...
        </Text>
      </View>
    );
  }

  // If we have a profile, render children
  if (currentProfile && profileId) {
    return <>{children}</>;
  }

  // Fallback loading state (should redirect before reaching here)
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-950">
      <Text className="text-lg text-neutral-600 dark:text-neutral-400">
        Checking profile...
      </Text>
    </View>
  );
}
