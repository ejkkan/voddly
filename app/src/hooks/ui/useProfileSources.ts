import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSourcesData } from '@/hooks/useSources';
import { apiClient } from '@/lib/api-client';

// Get all sources available to the account (for selection)
export function useAccountSources() {
  // Use the centralized sources data instead of making a separate API call
  const { data: sourcesData, isLoading, isError } = useSourcesData();

  return {
    data: { sources: sourcesData?.sources || [] },
    isLoading,
    isError,
    sources: sourcesData?.sources || [],
    accountId: sourcesData?.accountId,
  };
}

// Get sources accessible to a specific profile
export function useProfileSources(profileId: string) {
  return useQuery({
    queryKey: ['profile-sources', profileId],
    queryFn: async () => {
      return apiClient.user.getProfileSources(profileId);
    },
    enabled: !!profileId,
  });
}

// Update profile source restrictions
export function useUpdateProfileSources() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      profileId: string;
      sourceIds: string[];
      notes?: string;
    }) => {
      return apiClient.user.updateProfileSources(data.profileId, {
        sourceIds: data.sourceIds,
        notes: data.notes,
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['profile-sources', variables.profileId],
      });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profile-sources-audit'] });
    },
  });
}

// Remove a specific source from a profile
export function useRemoveProfileSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { profileId: string; sourceId: string }) => {
      return apiClient.user.removeProfileSource(data.profileId, data.sourceId);
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['profile-sources', variables.profileId],
      });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profile-sources-audit'] });
    },
  });
}

// Get profile source audit information
export function useProfileSourceAudit() {
  return useQuery({
    queryKey: ['profile-sources-audit'],
    queryFn: async () => {
      return apiClient.user.getProfileSourceAudit();
    },
  });
}
