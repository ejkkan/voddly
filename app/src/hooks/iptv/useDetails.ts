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
      const tKey = `[iptv][movie][${provider}] source=${sourceId} vod=${String(vodId)}`;
      const creds = await getCredentials(sourceId, {
        title: 'Decrypt Source',
        message: 'Enter your passphrase to fetch movie info',
      });
      const client = getIptvClient(provider, creds);
      if (!client.getVodInfo)
        throw new Error('Provider does not support VOD info');
      if (__DEV__) console.time(`${tKey} getVodInfo`);
      return client.getVodInfo(vodId).finally(() => {
        if (__DEV__) console.timeEnd(`${tKey} getVodInfo`);
      });
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
      const tKey = `[iptv][series][${provider}] source=${sourceId} series=${String(seriesId)}`;
      const creds = await getCredentials(sourceId, {
        title: 'Decrypt Source',
        message: 'Enter your passphrase to fetch series info',
      });
      const client = getIptvClient(provider, creds);
      if (!client.getSeriesInfo)
        throw new Error('Provider does not support series info');
      if (__DEV__) console.time(`${tKey} getSeriesInfo`);
      return client.getSeriesInfo(seriesId).finally(() => {
        if (__DEV__) console.timeEnd(`${tKey} getSeriesInfo`);
      });
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
      const tKey = `[iptv][epg][${provider}] source=${sourceId} stream=${String(streamId)} limit=${limit}`;
      const creds = await getCredentials(sourceId, {
        title: 'Decrypt Source',
        message: 'Enter your passphrase to fetch EPG',
      });
      const client = getIptvClient(provider, creds);
      if (!client.getShortEpg) throw new Error('Provider does not support EPG');
      if (__DEV__) console.time(`${tKey} getShortEpg`);
      return client.getShortEpg(streamId, limit).finally(() => {
        if (__DEV__) console.timeEnd(`${tKey} getShortEpg`);
      });
    },
    enabled: !!sourceId && streamId != null,
    staleTime: 60 * 1000,
  });
}
