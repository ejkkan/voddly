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
      const creds = await getCredentials(sourceId, {
        title: 'Decrypt Source',
        message: 'Enter your passphrase to fetch catalog',
      });
      const client = getIptvClient(provider, creds);
      return client.getCatalog();
    },
    enabled: !!sourceId,
    staleTime: 5 * 60 * 1000,
  });
}
