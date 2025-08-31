'use client';

import { useQuery } from '@tanstack/react-query';

import { useActiveAccountId } from '@/hooks/ui/useAccounts';
import { useSourceCredentialsCached } from '@/hooks/useSourceCredentials';
import { useSourcesData } from '@/hooks/useSources';

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
  const { getCredentials } = useSourceCredentialsCached();
  const { accountId, isLoading: accountsLoading } = useActiveAccountId();
  const { data: sourcesData, isLoading: sourcesLoading } = useSourcesData();

  return useQuery<UseSourceInfoResult>({
    queryKey: ['source', 'info', sourceId],
    enabled:
      !!sourceId &&
      !!accountId &&
      !accountsLoading &&
      !sourcesLoading &&
      (sourcesData?.sources || []).length > 0,
    queryFn: async () => {
      console.log('[useSourceInfo] Starting queryFn for sourceId:', sourceId);
      if (!sourceId) throw new Error('Missing sourceId');
      if (!accountId) throw new Error('No account found');

      // Use the cached sources data instead of making another API call
      const source = (sourcesData?.sources || []).find(
        (s: any) => s.id === sourceId || s.name === sourceId
      );

      console.log('[useSourceInfo] About to call getCredentials...');
      const credentials = await getCredentials(String(sourceId), {
        title: 'Decrypt Source',
        message: 'Enter your passphrase to access the source',
      });

      console.log('[useSourceInfo] getCredentials completed successfully');
      return {
        accountId: accountId as string,
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
