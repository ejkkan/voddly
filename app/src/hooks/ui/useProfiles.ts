import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

// Get all profiles for the current user
export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      return apiClient.user.getProfiles();
    },
  });
}

// Create a new profile
export function useCreateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      hasSourceRestrictions?: boolean;
      allowedSources?: string[];
    }) => {
      return apiClient.user.createProfileAsOwner(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

// Update a profile
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      profileId: string;
      name?: string;
      hasSourceRestrictions?: boolean;
      allowedSources?: string[];
    }) => {
      return apiClient.user.updateProfileAsOwner(data.profileId, {
        name: data.name,
        hasSourceRestrictions: data.hasSourceRestrictions,
        allowedSources: data.allowedSources,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

// Delete a profile
export function useDeleteProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { profileId: string }) => {
      return apiClient.user.deleteProfileAsOwner(data.profileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

// Check if current user is owner of a profile
export function useIsProfileOwner(profileId: string) {
  return useQuery({
    queryKey: ['profile-owner', profileId],
    queryFn: async () => {
      return apiClient.user.isProfileOwner(profileId);
    },
    enabled: !!profileId,
  });
}

// Switch to a different profile
export function useSwitchProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { profileId: string }) => {
      return apiClient.user.switchProfile(data.profileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}
