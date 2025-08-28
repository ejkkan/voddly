'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { useSourceCredentials } from '@/lib/source-credentials';

type UseSourceInfoResult = {
  accountId: string;
  source:
    | {
        id: string;
        name: string;
        provider_type?: string;
        encrypted_config?: string;
        config_iv?: string;
      }
    | undefined;
  baseUrl: string; // decrypted server URL
  credentials: {
    server: string;
    username: string;
    password: string;
    containerExtension?: string;
    videoCodec?: string;
    audioCodec?: string;
  };
};

export function useSourceInfo(sourceId?: string) {
  console.log('[useSourceInfo] Hook called with sourceId:', sourceId);
  const { getCredentials } = useSourceCredentials();
  return useQuery<UseSourceInfoResult>({
    queryKey: ['source', 'info', sourceId],
    enabled: !!sourceId,
    queryFn: async () => {
      console.log('[useSourceInfo] Starting queryFn for sourceId:', sourceId);
      if (!sourceId) throw new Error('Missing sourceId');

      console.log('[useSourceInfo] Fetching accounts...');
      const accounts = await apiClient.user.getAccounts();
      const first = accounts.accounts?.[0];
      if (!first) throw new Error('No account found');

      console.log('[useSourceInfo] Fetching sources for account:', first.id);
      const { sources } = await apiClient.user.getSources(first.id);
      const source = (sources || []).find(
        (s: any) => s.id === sourceId || s.name === sourceId
      );

      console.log('[useSourceInfo] About to call getCredentials...');
      const credentials = await getCredentials(String(sourceId), {
        title: 'Decrypt Source',
        message: 'Enter your passphrase to access the source',
      });

      console.log('[useSourceInfo] getCredentials completed successfully');
      return {
        accountId: first.id as string,
        source,
        baseUrl: credentials.server,
        credentials,
      } satisfies UseSourceInfoResult;
    },
    // Cache aggressively; base URL and credentials don't change often
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useSourceBaseUrl(sourceId?: string) {
  const q = useSourceInfo(sourceId);
  return { ...q, baseUrl: q.data?.baseUrl } as const;
}
