'use client';

import { useQuery } from '@tanstack/react-query';

import { getIptvClient, type ProviderType } from '@/lib/iptv/get-client';
import { useSourceCredentials } from '@/lib/source-credentials';

export function useIptvCatalog(provider: ProviderType, sourceId?: string) {
  const { getCredentials } = useSourceCredentials();
  return useQuery({
    queryKey: ['iptv', provider, 'catalog', sourceId],
    queryFn: async () => {
      if (!sourceId) throw new Error('Missing sourceId');
      const tKey = `[iptv][catalog][${provider}] source=${sourceId}`;
      const creds = await getCredentials(sourceId, {
        title: 'Decrypt Source',
        message: 'Enter your passphrase to fetch catalog',
      });
      const client = getIptvClient(provider, creds);
      if (__DEV__) console.time(`${tKey} getCatalog`);
      return client.getCatalog().finally(() => {
        if (__DEV__) console.timeEnd(`${tKey} getCatalog`);
      });
    },
    enabled: !!sourceId,
    staleTime: 5 * 60 * 1000,
  });
}
