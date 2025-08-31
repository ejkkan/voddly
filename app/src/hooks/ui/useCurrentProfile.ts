import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { useProfileStore } from '@/lib/profile-store';

import { useCreateProfile, useProfiles } from './useProfiles';

export function useCurrentProfile() {
  const { data: profilesData, isLoading } = useProfiles();
  const createProfile = useCreateProfile();
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const queryClient = useQueryClient();
  
  const { currentProfileId, setCurrentProfileId } = useProfileStore();

  const profiles = profilesData?.profiles || [];
  
  // Find the current profile based on stored ID, or fall back to owner/first profile
  const currentProfile = profiles.find((p) => p.id === currentProfileId) ||
                        profiles.find((p) => p.is_owner) || 
                        profiles[0];

  // Update stored profile ID when current profile changes
  useEffect(() => {
    if (currentProfile && currentProfile.id !== currentProfileId) {
      setCurrentProfileId(currentProfile.id);
    }
  }, [currentProfile, currentProfileId, setCurrentProfileId]);

  // If no profiles exist and we're not loading, try to create a default profile
  useEffect(() => {
    if (
      !isLoading &&
      profiles.length === 0 &&
      !createProfile.isPending &&
      !isCreatingProfile
    ) {
      console.log('No profiles found, attempting to create default profile');
      setIsCreatingProfile(true);
      createProfile.mutate(
        {
          name: 'Main',
          hasSourceRestrictions: false,
          allowedSources: [],
        },
        {
          onSuccess: () => {
            console.log('Profile created successfully');
            setIsCreatingProfile(false);
          },
          onError: (error: any) => {
            console.error('Failed to create default profile:', error);
            setIsCreatingProfile(false);
          },
        }
      );
    }
  }, [
    isLoading,
    profiles.length,
    createProfile.mutate,
    createProfile.isPending,
    isCreatingProfile,
  ]);

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

  // Don't return profileId until we have a profile or have finished trying to create one
  const shouldWaitForProfile =
    profiles.length === 0 && (createProfile.isPending || isCreatingProfile);

  return {
    currentProfile,
    isLoading: isLoading || createProfile.isPending || isCreatingProfile,
    profileId: shouldWaitForProfile ? undefined : currentProfile?.id,
    switchProfile,
    profiles,
  };
}
