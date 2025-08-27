'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useSourceCredentials } from '@/lib/source-credentials';
import { XtreamClient } from '@/lib/xtream-client';

type ContentType = 'live' | 'movie' | 'series';

export function useXtreamClient() {
  const { getCredentials } = useSourceCredentials();

  return {
    getClient: async (sourceId: string) => {
      const creds = await getCredentials(sourceId, {
        title: 'Decrypt Source',
        message: 'Enter your passphrase to access the source',
      });
      return new XtreamClient({
        server: creds.server,
        username: creds.username,
        password: creds.password,
      });
    },
  } as const;
}

export function useXtreamCatalog(sourceId?: string) {
  const { getClient } = useXtreamClient();
  return useQuery({
    queryKey: ['xtream', 'catalog', sourceId],
    queryFn: async () => {
      if (!sourceId) throw new Error('Missing sourceId');
      const client = await getClient(sourceId);
      return client.getCatalog();
    },
    enabled: !!sourceId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useXtreamCategories(sourceId?: string) {
  const q = useXtreamCatalog(sourceId);
  const categories = useMemo(() => q.data?.categories ?? [], [q.data]);
  return { ...q, categories } as const;
}

export function useXtreamCategoryContent(
  sourceId: string | undefined,
  contentType: ContentType,
  categoryId: string | number | undefined
) {
  const { getClient } = useXtreamClient();
  return useQuery({
    queryKey: ['xtream', 'category', contentType, sourceId, categoryId],
    queryFn: async () => {
      if (!sourceId || categoryId == null) throw new Error('Missing params');
      const client = await getClient(sourceId);
      switch (contentType) {
        case 'live':
          return client.getLiveStreamsByCategory(categoryId);
        case 'movie':
          return client.getVodStreamsByCategory(categoryId);
        case 'series':
          return client.getSeriesByCategory(categoryId);
      }
    },
    enabled: !!sourceId && categoryId != null,
    staleTime: 5 * 60 * 1000,
  });
}

export function useXtreamMovieInfo(
  sourceId: string | undefined,
  vodId: string | number | undefined
) {
  const { getClient } = useXtreamClient();
  return useQuery({
    queryKey: ['xtream', 'movie', sourceId, vodId],
    queryFn: async () => {
      if (!sourceId || vodId == null) throw new Error('Missing params');
      const client = await getClient(sourceId);
      return client.getVodInfo(vodId);
    },
    enabled: !!sourceId && vodId != null,
  });
}

export function useXtreamSeriesInfo(
  sourceId: string | undefined,
  seriesId: string | number | undefined
) {
  const { getClient } = useXtreamClient();
  return useQuery({
    queryKey: ['xtream', 'series', sourceId, seriesId],
    queryFn: async () => {
      if (!sourceId || seriesId == null) throw new Error('Missing params');
      const client = await getClient(sourceId);
      return client.getSeriesInfo(seriesId);
    },
    enabled: !!sourceId && seriesId != null,
  });
}

export function useXtreamShortEpg(
  sourceId: string | undefined,
  streamId: string | number | undefined,
  limit = 10
) {
  const { getClient } = useXtreamClient();
  return useQuery({
    queryKey: ['xtream', 'epg', sourceId, streamId, limit],
    queryFn: async () => {
      if (!sourceId || streamId == null) throw new Error('Missing params');
      const client = await getClient(sourceId);
      return client.getShortEpg(streamId, limit);
    },
    enabled: !!sourceId && streamId != null,
    staleTime: 60 * 1000,
  });
}
