'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

export function usePlayerBundle(profileId: string | undefined, contentUid: string | undefined) {
  return useQuery({
    queryKey: ['player', profileId, contentUid],
    queryFn: async () => {
      if (!profileId || !contentUid) throw new Error('Missing params');
      return apiClient.user.getPlayerBundle({ profileId, contentUid });
    },
    enabled: !!profileId && !!contentUid,
    staleTime: 30_000,
  });
}

