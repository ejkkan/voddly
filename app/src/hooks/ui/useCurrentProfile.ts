import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { useProfileStore } from '@/lib/profile-store';

import { useProfiles } from './useProfiles';

export function useCurrentProfile() {
  const { data: profilesData, isLoading } = useProfiles();
  const queryClient = useQueryClient();
  
  const { currentProfileId, setCurrentProfileId } = useProfileStore();

  const profiles = profilesData?.profiles || [];
  
  // Only use the stored profile ID, don't auto-select
  const currentProfile = profiles.find((p) => p.id === currentProfileId);

  // Only auto-select if there's exactly one profile and no current selection
  useEffect(() => {
    if (!currentProfileId && profiles.length === 1) {
      // Auto-select the single profile
      setCurrentProfileId(profiles[0].id);
    }
  }, [profiles, currentProfileId, setCurrentProfileId]);

  // No longer auto-create profiles - let ProfileGuard handle redirecting to picker
  useEffect(() => {
    if (!isLoading && profiles.length === 0) {
      console.log('No profiles found, user needs to create one');
    }
  }, [isLoading, profiles.length]);

  // Function to switch profiles and invalidate all relevant queries
  const switchProfile = async (profileId: string) => {
    // First update the stored profile ID
    setCurrentProfileId(profileId);
    
    // Invalidate all profile-specific queries to force refresh with new profile data
    await Promise.all([
      // Profile-specific data
      queryClient.invalidateQueries({ queryKey: ['favorites', profileId] }),
      queryClient.invalidateQueries({ queryKey: ['playlists', profileId] }),
      queryClient.invalidateQueries({ queryKey: ['watch-state'] }),
      queryClient.invalidateQueries({ queryKey: ['sources', 'profile', profileId] }),
      queryClient.invalidateQueries({ queryKey: ['player'] }),
      
      // Clear old profile data
      queryClient.invalidateQueries({ queryKey: ['favorites'] }),
      queryClient.invalidateQueries({ queryKey: ['playlists'] }),
      
      // Dashboard and UI data that may depend on profile
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['epg'] }),
      queryClient.invalidateQueries({ queryKey: ['ui-sections'] }),
      queryClient.invalidateQueries({ queryKey: ['ui-preview'] }),
      
      // Profile ownership checks
      queryClient.invalidateQueries({ queryKey: ['profile-owner'] }),
    ]);
    
    // Optional: Call the backend switch profile endpoint if it exists
    try {
      await apiClient.user.switchProfile(profileId);
    } catch (error) {
      console.log('Backend switch profile not implemented or failed:', error);
    }
  };

  return {
    currentProfile,
    isLoading,
    profileId: currentProfile?.id,
    switchProfile,
    profiles,
  };
}
