import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { View, Text } from '@/components/ui';
import { useCurrentProfile } from '@/hooks/ui/useCurrentProfile';

interface ProfileGuardProps {
  children: React.ReactNode;
}

export function ProfileGuard({ children }: ProfileGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentProfile, isLoading, profileId, profiles } = useCurrentProfile();
  const [isChecking, setIsChecking] = useState(true);
  
  // Debug logging to help identify the issue
  console.log('[ProfileGuard] State check:', {
    isLoading,
    isChecking,
    currentProfile: currentProfile?.id,
    profileId,
    profilesCount: profiles.length,
    pathname
  });
  
  // Don't guard the profile-picker route itself
  const isProfilePickerRoute = pathname === '/(app)/profile-picker' || pathname === '/profile-picker';
  
  useEffect(() => {
    // Skip guard check for profile picker route
    if (isProfilePickerRoute) {
      setIsChecking(false);
      return;
    }
    
    // Only proceed when profiles have finished loading
    if (isLoading) {
      return;
    }
    
    console.log('[ProfileGuard] Processing profile logic:', {
      profilesLength: profiles.length,
      profileId,
      currentProfile: currentProfile?.id
    });
    
    // Check different scenarios:
    if (profiles.length === 0) {
      // No profiles exist, need to create one
      console.log('[ProfileGuard] No profiles found, redirecting to picker');
      router.replace('/(app)/profile-picker');
      return;
    }
    
    if (profiles.length > 1 && !profileId) {
      // Multiple profiles but none selected, need to pick
      console.log('[ProfileGuard] Multiple profiles, none selected, redirecting to picker');
      router.replace('/(app)/profile-picker');
      return;
    }
    
    // If we have profiles and either single profile or one is selected, we're good
    if (profiles.length > 0) {
      console.log('[ProfileGuard] Profiles available, stopping check');
      setIsChecking(false);
    }
  }, [profiles, profileId, currentProfile, isLoading, router, isProfilePickerRoute]);
  
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