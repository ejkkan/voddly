import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Pressable,
} from '@/components/ui';
import { useSession } from '@/lib/auth/hooks';
import { apiClient } from '@/lib/api-client';
import { MobileCatalogStorage } from '@/lib/catalog-storage';
import { passphraseCache } from '@/lib/passphrase-cache';

export default function Playlists() {
  const router = useRouter();
  const { data: session } = useSession();
  const [sources, setSources] = useState<
    Array<{ id: string; name: string; provider_type: string }>
  >([]);
  const [stats, setStats] = useState<Record<string, { channels: number }>>({});
  const [loadingSourceId, setLoadingSourceId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        if (!session?.data?.user) return;
        const accounts = await apiClient.user.getAccounts();
        const first = accounts.accounts?.[0];
        if (!first) return;
        const { sources } = await apiClient.user.getSources(first.id);
        if (!mounted) return;
        setSources(sources || []);

        // Load per-source stats from local storage
        const storage = new MobileCatalogStorage();
        const next: Record<string, { channels: number }> = {};
        for (const s of sources || []) {
          try {
            const sStats = await storage.getCatalogStats(s.id);
            next[s.id] = { channels: sStats.channels };
          } catch {
            // ignore
          }
        }
        if (mounted) setStats(next);
      } catch (e) {
        // noop
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [session?.data?.user]);

  const handleReload = async (sourceId: string) => {
    if (loadingSourceId) return;
    setLoadingSourceId(sourceId);
    try {
      // Fetch latest catalog from server using the same logic as add.tsx
      // 1) Find the account that owns this source
      const accounts = await apiClient.user.getAccounts();
      const first = accounts.accounts?.[0];
      if (!first) throw new Error('No account');
      const { sources: srcs, keyData } = await apiClient.user.getSources(
        first.id
      );
      const src = (srcs || []).find((s) => s.id === sourceId);
      if (!src) throw new Error('Source not found');

      // 2) Determine provider and rebuild endpoints
      const provider = (src.provider_type || '').toLowerCase();
      const storage = new MobileCatalogStorage();

      if (provider === 'xtream') {
        // Decrypt credentials using passphrase and keyData
        if (!keyData) throw new Error('Missing key data');

        // Get or prompt for passphrase
        let passphrase = passphraseCache.get(first.id);
        if (!passphrase) {
          // Basic prompt on web; in native we could navigate to a modal later
          // eslint-disable-next-line no-alert
          const input =
            typeof window !== 'undefined'
              ? window.prompt('Enter your passphrase to decrypt this playlist:')
              : '';
          if (!input || input.length < 6)
            throw new Error('Passphrase required');
          passphrase = input;
          passphraseCache.set(first.id, passphrase);
        }

        // Helpers for base64
        const b64ToBytes = (b64: string) => {
          try {
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return bytes;
          } catch {
            // URL-safe base64 fallback
            const fixed = b64.replace(/-/g, '+').replace(/_/g, '/');
            const pad =
              fixed.length % 4 === 0 ? '' : '='.repeat(4 - (fixed.length % 4));
            const bin = atob(fixed + pad);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return bytes;
          }
        };

        // Derive personal key from passphrase
        const salt = b64ToBytes(keyData.salt);
        const iv = b64ToBytes(keyData.iv);
        const wrapped = b64ToBytes(keyData.wrapped_master_key);
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          encoder.encode(passphrase),
          'PBKDF2',
          false,
          ['deriveKey']
        );
        const personalKey = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt,
            iterations: keyData.iterations || 500000,
            hash: 'SHA-256',
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );
        const masterKeyBytes = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          personalKey,
          wrapped
        );
        const masterKey = await crypto.subtle.importKey(
          'raw',
          masterKeyBytes,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );

        // Decrypt source config
        const cfgIv = b64ToBytes(src.config_iv);
        const cfgEnc = b64ToBytes(src.encrypted_config);
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: cfgIv },
          masterKey,
          cfgEnc
        );
        const credentials = JSON.parse(
          new TextDecoder().decode(new Uint8Array(decrypted))
        ) as {
          server: string;
          username: string;
          password: string;
        };

        // Fetch fresh catalog and store
        const buildXtreamUrl = (
          action: string,
          params: Record<string, string | number> = {}
        ) => {
          const base = credentials.server.endsWith('/')
            ? credentials.server.slice(0, -1)
            : credentials.server;
          const url = new URL(`${base}/player_api.php`);
          const search = new URLSearchParams({
            username: credentials.username,
            password: credentials.password,
            action,
          });
          for (const [k, v] of Object.entries(params)) search.set(k, String(v));
          url.search = search.toString();
          return url.toString();
        };

        const [
          liveCategories,
          vodCategories,
          seriesCategories,
          liveStreams,
          vodStreams,
          seriesList,
        ] = await Promise.all([
          fetch(buildXtreamUrl('get_live_categories'))
            .then((r) => r.json())
            .catch(() => []),
          fetch(buildXtreamUrl('get_vod_categories'))
            .then((r) => r.json())
            .catch(() => []),
          fetch(buildXtreamUrl('get_series_categories'))
            .then((r) => r.json())
            .catch(() => []),
          fetch(buildXtreamUrl('get_live_streams'))
            .then((r) => r.json())
            .catch(() => []),
          fetch(buildXtreamUrl('get_vod_streams'))
            .then((r) => r.json())
            .catch(() => []),
          fetch(buildXtreamUrl('get_series'))
            .then((r) => r.json())
            .catch(() => []),
        ]);

        const categories = [
          ...(Array.isArray(liveCategories) ? liveCategories : []).map(
            (cat: any) => ({ ...cat, type: 'live' })
          ),
          ...(Array.isArray(vodCategories) ? vodCategories : []).map(
            (cat: any) => ({ ...cat, type: 'vod' })
          ),
          ...(Array.isArray(seriesCategories) ? seriesCategories : []).map(
            (cat: any) => ({ ...cat, type: 'series' })
          ),
        ];

        await storage.storeSourceCatalog(sourceId, {
          categories,
          movies: Array.isArray(vodStreams) ? vodStreams : [],
          series: Array.isArray(seriesList) ? seriesList : [],
          channels: Array.isArray(liveStreams) ? liveStreams : [],
        });
      } else if (provider === 'm3u') {
        // Without storing raw URL, we cannot refetch securely here.
        // Future: store encrypted M3U URL as a secret and decrypt similarly.
      }

      // Update visible stats after (re)load
      try {
        const sStats = await storage.getCatalogStats(sourceId);
        setStats((prev) => ({
          ...prev,
          [sourceId]: { channels: sStats.channels },
        }));
      } catch {}
    } catch (e) {
      // ignore
    } finally {
      setLoadingSourceId(null);
    }
  };

  return (
    <SafeAreaView>
      <ScrollView
        className="flex-1 bg-white dark:bg-black"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="flex-row items-center justify-between px-6 py-4">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            Playlists
          </Text>
          <Pressable
            className="rounded-xl border border-neutral-200 px-4 py-2 dark:border-neutral-800"
            onPress={() => router.push('/(app)/playlists/add')}
          >
            <Text className="text-neutral-900 dark:text-neutral-50">
              Add playlist
            </Text>
          </Pressable>
        </View>

        <View className="px-6">
          {sources.length === 0 ? (
            <Text className="text-neutral-600 dark:text-neutral-400">
              No playlists yet.
            </Text>
          ) : (
            sources.map((s) => {
              const provider = (s.provider_type || '').toLowerCase();
              const label =
                provider === 'xtream' ? 'IPTV Xtream' : provider.toUpperCase();
              const ch = stats[s.id]?.channels;
              const isLoading = loadingSourceId === s.id;
              return (
                <View
                  key={s.id}
                  className="mb-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
                >
                  <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
                    {s.name}
                  </Text>
                  <Text className="text-neutral-600 dark:text-neutral-400">
                    {label}
                    {typeof ch === 'number' ? ` • ${ch} channels` : ''}
                  </Text>
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    ID: {s.id}
                  </Text>
                  <View className="mt-3 flex-row gap-3">
                    <Pressable
                      disabled={isLoading}
                      className={`rounded-xl px-3 py-2 ${
                        isLoading
                          ? 'opacity-60 border border-neutral-300 dark:border-neutral-700'
                          : 'bg-neutral-900'
                      }`}
                      onPress={() => handleReload(s.id)}
                    >
                      <Text
                        className={
                          isLoading
                            ? 'text-neutral-800 dark:text-neutral-200'
                            : 'text-white'
                        }
                      >
                        {isLoading ? 'Reloading…' : 'Reload'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
