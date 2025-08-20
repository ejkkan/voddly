import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { apiClient } from '@/lib/api-client';
import { MobileCatalogStorage } from '@/lib/catalog-storage';
import { SourceCredentialsManager } from '@/lib/source-credentials';
import {
  downloadM3UCatalog,
  downloadXtreamCatalog,
} from '@/lib/catalog-downloaders';
import { getIptvClient } from '@/lib/iptv/get-client';
import { passphraseCache } from '@/lib/passphrase-cache';
import { getRegisteredPassphraseResolver } from '@/lib/passphrase-ui';
import { showMessage } from 'react-native-flash-message';

export type SourceSummary = { id: string; name: string; provider_type: string };

export function useSources() {
  const queryClient = useQueryClient();
  const [reloadingId, setReloadingId] = React.useState<string | null>(null);

  const sourcesQuery = useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      const accounts = await apiClient.user.getAccounts();
      const first = accounts.accounts?.[0];
      if (!first)
        return {
          accountId: null as string | null,
          sources: [] as SourceSummary[],
        };
      const { sources } = await apiClient.user.getSources(first.id);
      return { accountId: first.id as string, sources: sources || [] };
    },
  });

  const reloadMutation = useMutation({
    mutationFn: async ({ sourceId }: { sourceId: string }) => {
      const accountId = sourcesQuery.data?.accountId;
      if (!accountId) throw new Error('No account');
      const { sources, keyData } = await apiClient.user.getSources(accountId);
      const src = (sources || []).find((s) => s.id === sourceId);
      if (!src) throw new Error('Source not found');
      const provider = (src.provider_type || '').toLowerCase();

      const storage = new MobileCatalogStorage();

      const manager = new SourceCredentialsManager({
        getPassphrase: async (accId, opts) => {
          const cached = passphraseCache.get(accId);
          if (cached) return cached;
          const resolver = getRegisteredPassphraseResolver();
          if (!resolver) throw new Error('Passphrase required');
          return resolver(accId, {
            title: opts?.title,
            message: opts?.message,
            accountName: opts?.accountName,
          });
        },
      });

      // Decrypt credentials
      const creds = await manager.getSourceCredentials(sourceId, {
        title: 'Decrypt Source',
        message: 'Enter your passphrase to decrypt the source',
      });

      if (provider === 'xtream') {
        const data = await getIptvClient('xtream', {
          server: creds.server,
          username: creds.username,
          password: creds.password,
        }).getCatalog();
        if (__DEV__)
          console.log('[reload] xtream fetched', {
            cats: data.categories.length,
            movies: data.movies.length,
            series: data.series.length,
            channels: data.channels.length,
            sampleCats: data.categories.slice(0, 3),
            sampleMovies: data.movies.slice(0, 3),
            sampleSeries: data.series.slice(0, 3),
            sampleChannels: data.channels.slice(0, 3),
          });
        await storage.storeSourceCatalog(sourceId, data);
      } else if (provider === 'm3u') {
        const data = await getIptvClient('m3u', {
          server: creds.server,
        }).getCatalog();
        if (__DEV__)
          console.log('[reload] m3u fetched', {
            cats: data.categories.length,
            movies: data.movies.length,
            series: data.series.length,
            channels: data.channels.length,
            sampleChannels: data.channels.slice(0, 3),
          });
        await storage.storeSourceCatalog(sourceId, data);
      }

      // Return minimal stats
      try {
        const s = await storage.getCatalogStats(sourceId);
        if (__DEV__) console.log('[reload] stats after store', s);
        return { sourceId, channels: s.channels };
      } catch {
        return { sourceId, channels: 0 };
      }
    },
    onMutate: (vars) => {
      if (__DEV__) console.log('[reload] start', vars);
      setReloadingId(vars.sourceId);
    },
    onSuccess: (data) => {
      if (__DEV__) console.log('[reload] success', data);
      const key = [
        'source-stats',
        sourcesQuery.data?.sources?.map((s) => s.id) || [],
      ];
      queryClient.setQueryData<Record<string, { channels: number }>>(
        key,
        (prev) => ({
          ...(prev || {}),
          [data.sourceId]: { channels: data.channels },
        })
      );
      showMessage({
        message: 'Playlist updated',
        description: 'Catalog stored successfully',
        type: 'success',
      });
    },
    onError: (err: any) => {
      if (__DEV__) console.log('[reload] error', err);
      showMessage({
        message: 'Reload failed',
        description: String(err?.message || err),
        type: 'danger',
      });
    },
    onSettled: () => {
      if (__DEV__) console.log('[reload] settled');
      setReloadingId(null);
      void queryClient.invalidateQueries({ queryKey: ['source-stats'] });
    },
  });

  const statsQuery = useQuery({
    enabled: (sourcesQuery.data?.sources || []).length > 0,
    queryKey: [
      'source-stats',
      sourcesQuery.data?.sources?.map((s) => s.id) || [],
    ],
    queryFn: async () => {
      const storage = new MobileCatalogStorage();
      const entries: Record<string, { channels: number }> = {};
      for (const s of sourcesQuery.data?.sources || []) {
        try {
          const st = await storage.getCatalogStats(s.id);
          entries[s.id] = { channels: st.channels };
        } catch {}
      }
      return entries;
    },
  });

  return {
    accountId: sourcesQuery.data?.accountId || null,
    sources: sourcesQuery.data?.sources || [],
    sourcesQuery,
    stats: statsQuery.data || {},
    reloadSource: (sourceId: string) =>
      reloadMutation.mutateAsync({ sourceId }),
    reloadIsLoading: reloadMutation.isPending,
    reloadingId,
  };
}
