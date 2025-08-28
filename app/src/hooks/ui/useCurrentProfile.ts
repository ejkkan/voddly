import { useEffect, useState } from 'react';

import { useCreateProfile, useProfiles } from './useProfiles';

export function useCurrentProfile() {
  const { data: profilesData, isLoading } = useProfiles();
  const createProfile = useCreateProfile();
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  const profiles = profilesData?.profiles || [];
  const currentProfile = profiles.find((p) => p.is_owner) || profiles[0];

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
  }, [isLoading, profiles.length, createProfile, isCreatingProfile]);

  // Don't return profileId until we have a profile or have finished trying to create one
  const shouldWaitForProfile =
    profiles.length === 0 && (createProfile.isPending || isCreatingProfile);

  return {
    currentProfile,
    isLoading: isLoading || createProfile.isPending || isCreatingProfile,
    profileId: shouldWaitForProfile ? undefined : currentProfile?.id,
  };
}
