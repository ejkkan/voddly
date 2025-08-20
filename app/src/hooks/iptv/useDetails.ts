'use client';

import { useQuery } from '@tanstack/react-query';
import { getIptvClient, type ProviderType } from '@/lib/iptv/get-client';
import { useSourceCredentials } from '@/lib/source-credentials';

export function useIptvMovieInfo(
  provider: ProviderType,
  sourceId: string | undefined,
  vodId: string | number | undefined
) {
  const { getCredentials } = useSourceCredentials();
  return useQuery({
    queryKey: ['iptv', provider, 'movie', sourceId, vodId],
    queryFn: async () => {
      if (!sourceId || vodId == null) throw new Error('Missing params');
      const creds = await getCredentials(sourceId, {
        title: 'Decrypt Source',
        message: 'Enter your passphrase to fetch movie info',
      });
      const client = getIptvClient(provider, creds);
      if (!client.getVodInfo)
        throw new Error('Provider does not support VOD info');
      return client.getVodInfo(vodId);
    },
    enabled: !!sourceId && vodId != null,
  });
}

export function useIptvSeriesInfo(
  provider: ProviderType,
  sourceId: string | undefined,
  seriesId: string | number | undefined
) {
  const { getCredentials } = useSourceCredentials();
  return useQuery({
    queryKey: ['iptv', provider, 'series', sourceId, seriesId],
    queryFn: async () => {
      if (!sourceId || seriesId == null) throw new Error('Missing params');
      const creds = await getCredentials(sourceId, {
        title: 'Decrypt Source',
        message: 'Enter your passphrase to fetch series info',
      });
      const client = getIptvClient(provider, creds);
      if (!client.getSeriesInfo)
        throw new Error('Provider does not support series info');
      return client.getSeriesInfo(seriesId);
    },
    enabled: !!sourceId && seriesId != null,
  });
}

export function useIptvShortEpg(
  provider: ProviderType,
  sourceId: string | undefined,
  streamId: string | number | undefined,
  limit = 10
) {
  const { getCredentials } = useSourceCredentials();
  return useQuery({
    queryKey: ['iptv', provider, 'epg', sourceId, streamId, limit],
    queryFn: async () => {
      if (!sourceId || streamId == null) throw new Error('Missing params');
      const creds = await getCredentials(sourceId, {
        title: 'Decrypt Source',
        message: 'Enter your passphrase to fetch EPG',
      });
      const client = getIptvClient(provider, creds);
      if (!client.getShortEpg) throw new Error('Provider does not support EPG');
      return client.getShortEpg(streamId, limit);
    },
    enabled: !!sourceId && streamId != null,
    staleTime: 60 * 1000,
  });
}
