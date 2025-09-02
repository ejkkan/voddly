import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { hideMessage, showMessage } from 'react-native-flash-message';

import { useAccountsData } from '@/hooks/ui/useAccounts';
import { apiClient } from '@/lib/api-client';
import { MobileCatalogStorage } from '@/lib/catalog-storage';
import { getIptvClient } from '@/lib/iptv/get-client';
import { passphraseCache } from '@/lib/passphrase-cache';
import { getRegisteredPassphraseResolver } from '@/lib/passphrase-ui';
import { SourceCredentialsManager } from '@/lib/source-credentials';
import { notify, toast } from '@/lib/toast';

export type SourceSummary = { id: string; name: string; provider_type: string };

// Centralized hook for sources data - all other hooks should use this
export function useSourcesData() {
  const { data: accountsData, isLoading: accountsLoading } = useAccountsData();

  return useQuery({
    queryKey: ['sources', 'data'],
    queryFn: async () => {
      const tKey = '[sources] getSources';
      if (__DEV__) console.time(`${tKey}`);

      try {
        // Use the more efficient getSources endpoint (no longer includes keyData for security)
        const response = await apiClient.user.getSources({});
        if (__DEV__) console.log('[sources] Got sources response:', response);

        const first = accountsData?.accounts?.[0];
        return {
          accountId: first?.id || null,
          sources: response.sources || [],
        };
      } catch (error) {
        if (__DEV__) console.error('[sources] Error fetching sources:', error);
        return {
          accountId: null,
          sources: [],
        };
      } finally {
        if (__DEV__) console.timeEnd(`${tKey}`);
      }
    },
    // Only run when we have accounts data
    enabled: !!accountsData && !accountsLoading,
    // Add better caching - sources don't change often
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

// Main hook that provides sources data and reload functionality
export function useSources() {
  const queryClient = useQueryClient();
  const [reloadingId, setReloadingId] = React.useState<string | null>(null);
  const sourcesQuery = useSourcesData();

  // Store loading toast IDs for cleanup
  const loadingToastIdRef = React.useRef<string | null>(null);
  // Store FlashMessage reference for cleanup
  const flashMessageRef = React.useRef<any>(null);

  // Cleanup any lingering toasts on unmount
  React.useEffect(() => {
    return () => {
      if (loadingToastIdRef.current) {
        toast.dismiss(loadingToastIdRef.current);
      }
      // Don't hide FlashMessage on unmount - let it persist
    };
  }, []);

  const reloadMutation = useMutation({
    mutationFn: async ({ sourceId }: { sourceId: string }) => {
      const accountId = sourcesQuery.data?.accountId;
      if (!accountId) throw new Error('No account');
      let sources;
      try {
        const response = await apiClient.user.getSources({});
        sources = response.sources;
      } catch (error) {
        if (__DEV__) console.error('[reload] Error fetching sources:', error);
        throw error;
      }
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
      const tKey = `[sources][reload] provider=${provider} source=${sourceId}`;
      const creds = await manager.getSourceCredentials(sourceId, {
        title: 'Decrypt Source',
        message: 'Enter your passphrase to decrypt the source',
      });

      if (provider === 'xtream') {
        if (__DEV__) console.time(`${tKey} getCatalog`);
        const data = await getIptvClient('xtream', {
          server: creds.server,
          username: creds.username,
          password: creds.password,
        }).getCatalog();

        await storage.storeSourceCatalog(
          accountId,
          sourceId,
          data,
          creds.server
        );
      } else if (provider === 'm3u') {
        if (__DEV__) console.time(`${tKey} getCatalog`);
        const data = await getIptvClient('m3u', {
          server: creds.server,
        })
          .getCatalog()
          .finally(() => {
            if (__DEV__) console.timeEnd(`${tKey} getCatalog`);
          });
        if (__DEV__)
          console.log('[reload] m3u fetched', {
            cats: data.categories.length,
            movies: data.movies.length,
            series: data.series.length,
            channels: data.channels.length,
            sampleChannels: data.channels.slice(0, 3),
          });
        await storage.storeSourceCatalog(
          accountId,
          sourceId,
          data,
          creds.server
        );
      }

      // Return minimal stats
      try {
        const s = await storage.getCatalogStats(accountId, sourceId);
        if (__DEV__) console.log('[reload] stats after store', s);
        return { sourceId, channels: s.channels };
      } catch {
        return { sourceId, channels: 0 };
      }
    },
    onMutate: (vars) => {
      if (__DEV__) console.log('[reload] start', vars);
      setReloadingId(vars.sourceId);

      // Find the source name for a better toast message
      const source = sourcesQuery.data?.sources?.find(
        (s) => s.id === vars.sourceId
      );
      const sourceName = source?.name || 'playlist';

      // Create a persistent loading toast with a unique ID
      const toastId = `reload-${vars.sourceId}`;
      loadingToastIdRef.current = toastId;

      if (__DEV__)
        console.log('[reload] showing loading toast', toastId, sourceName);

      // Try both toast systems
      toast.loading(`Reloading ${sourceName}...`, {
        id: toastId,
        duration: 999999, // Very long duration (instead of Infinity)
      });

      // Also show with FlashMessage as fallback
      flashMessageRef.current = showMessage({
        message: `Reloading ${sourceName}...`,
        description: 'Please wait while we update your playlist',
        type: 'info',
        duration: 999999,
        autoHide: false,
        floating: true,
        hideOnPress: false, // Don't hide when pressed
        icon: 'auto', // Show icon
      });
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

      // Dismiss the loading toast
      if (loadingToastIdRef.current) {
        if (__DEV__)
          console.log(
            '[reload] dismissing loading toast',
            loadingToastIdRef.current
          );
        toast.dismiss(loadingToastIdRef.current);
      }

      // Invalidate trends caches since new content may be available
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'trends'] });

      // Show success notification
      const source = sourcesQuery.data?.sources?.find(
        (s) => s.id === data.sourceId
      );
      const sourceName = source?.name || 'Playlist';

      if (__DEV__)
        console.log(
          '[reload] showing success toast',
          sourceName,
          data.channels
        );

      // Try new toast
      notify.success(`${sourceName} updated successfully!`, {
        description: `Loaded ${data.channels} channels`,
        duration: 4000,
      });

      // Hide loading message and show success with FlashMessage
      hideMessage();
      setTimeout(() => {
        showMessage({
          message: `${sourceName} updated successfully!`,
          description: `Loaded ${data.channels} channels`,
          type: 'success',
          duration: 4000,
          autoHide: true,
          icon: 'success',
        });
      }, 100); // Small delay to ensure loading message is hidden first
    },
    onError: (err: any) => {
      if (__DEV__) console.log('[reload] error', err);

      // Dismiss the loading toast
      if (loadingToastIdRef.current) {
        if (__DEV__)
          console.log(
            '[reload] dismissing loading toast on error',
            loadingToastIdRef.current
          );
        toast.dismiss(loadingToastIdRef.current);
      }

      // Show error notification
      if (__DEV__)
        console.log('[reload] showing error toast', err?.message || err);

      // Try new toast
      notify.error('Reload failed', {
        description: String(err?.message || err),
        duration: 5000,
      });

      // Hide loading message and show error with FlashMessage
      hideMessage();
      setTimeout(() => {
        showMessage({
          message: 'Reload failed',
          description: String(err?.message || err),
          type: 'danger',
          duration: 5000,
          autoHide: true,
          icon: 'danger',
        });
      }, 100); // Small delay to ensure loading message is hidden first
    },
    onSettled: () => {
      if (__DEV__) console.log('[reload] settled');
      setReloadingId(null);
      loadingToastIdRef.current = null;
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
          const sKey = `[sources][stats] account=${sourcesQuery.data?.accountId} source=${s.id}`;
          if (__DEV__) console.time(`${sKey} getCatalogStats`);
          const st = await storage
            .getCatalogStats(sourcesQuery.data?.accountId as string, s.id)
            .finally(() => {
              if (__DEV__) console.timeEnd(`${sKey} getCatalogStats`);
            });
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
