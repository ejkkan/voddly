'use client';

import { useQuery } from '@tanstack/react-query';
import { getIptvClient, type ProviderType } from '@/lib/iptv/get-client';
import { useSourceCredentials } from '@/lib/source-credentials';

type ContentType = 'live' | 'movie' | 'series';

export function useIptvCategoryContent(
  provider: ProviderType,
  sourceId: string | undefined,
  contentType: ContentType,
  categoryId: string | number | undefined
) {
  const { getCredentials } = useSourceCredentials();
  return useQuery({
    queryKey: ['iptv', provider, 'category', contentType, sourceId, categoryId],
    queryFn: async () => {
      if (!sourceId || categoryId == null) throw new Error('Missing params');
      const tKey = `[iptv][category][${provider}][${contentType}] source=${sourceId} category=${String(categoryId)}`;
      const creds = await getCredentials(sourceId, {
        title: 'Decrypt Source',
        message: 'Enter your passphrase to fetch category content',
      });
      const client = getIptvClient(provider, creds);
      switch (contentType) {
        case 'live':
          if (!client.getLiveStreamsByCategory)
            throw new Error(
              'Provider does not support live streams by category'
            );
          if (__DEV__) console.time(`${tKey} getLiveStreamsByCategory`);
          return client.getLiveStreamsByCategory(categoryId).finally(() => {
            if (__DEV__) console.timeEnd(`${tKey} getLiveStreamsByCategory`);
          });
        case 'movie':
          if (!client.getVodStreamsByCategory)
            throw new Error(
              'Provider does not support VOD streams by category'
            );
          if (__DEV__) console.time(`${tKey} getVodStreamsByCategory`);
          return client.getVodStreamsByCategory(categoryId).finally(() => {
            if (__DEV__) console.timeEnd(`${tKey} getVodStreamsByCategory`);
          });
        case 'series':
          if (!client.getSeriesByCategory)
            throw new Error('Provider does not support series by category');
          if (__DEV__) console.time(`${tKey} getSeriesByCategory`);
          return client.getSeriesByCategory(categoryId).finally(() => {
            if (__DEV__) console.timeEnd(`${tKey} getSeriesByCategory`);
          });
      }
    },
    enabled: !!sourceId && categoryId != null,
    staleTime: 5 * 60 * 1000,
  });
}
