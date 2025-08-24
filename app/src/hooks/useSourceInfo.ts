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
  const { getCredentials } = useSourceCredentials();
  return useQuery<UseSourceInfoResult>({
    queryKey: ['source', 'info', sourceId],
    enabled: !!sourceId,
    queryFn: async () => {
      if (!sourceId) throw new Error('Missing sourceId');
      const accounts = await apiClient.user.getAccounts();
      const first = accounts.accounts?.[0];
      if (!first) throw new Error('No account found');
      const { sources } = await apiClient.user.getSources(first.id);
      const source = (sources || []).find(
        (s: any) => s.id === sourceId || s.name === sourceId
      );
      const credentials = await getCredentials(String(sourceId), {
        title: 'Decrypt Source',
        message: 'Enter your passphrase to access the source',
      });
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
