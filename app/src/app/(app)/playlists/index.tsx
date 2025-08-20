import React from 'react';
// @ts-ignore
import { useRouter } from 'expo-router';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Pressable,
} from '@/components/ui';
import { useSession } from '@/lib/auth/hooks';
import { useSources } from '@/hooks/useSources';
import { PlaylistCard } from '@/components/playlists/PlaylistCard';
import { SourceCredentialsManager } from '@/lib/source-credentials';
import { getRegisteredPassphraseResolver } from '@/lib/passphrase-ui';
import { passphraseCache } from '@/lib/passphrase-cache';
import { XtreamClient } from '@/lib/xtream-client';

export default function Playlists() {
  const router = useRouter();
  const { data: session } = useSession();
  const { sources, stats, reloadSource, reloadIsLoading, reloadingId } =
    useSources();

  const testCats = async (
    action:
      | 'get_live_categories'
      | 'get_vod_categories'
      | 'get_series_categories'
  ) => {
    try {
      const src = sources[0];
      if (!src) {
        if (__DEV__) console.log('[dev] no source to test');
        return;
      }
      const creds = await new SourceCredentialsManager({
        getPassphrase: async (accountId, opts) => {
          const cached = passphraseCache.get(accountId);
          if (cached) return cached;
          const resolver = getRegisteredPassphraseResolver();
          if (!resolver) throw new Error('Passphrase required');
          return resolver(accountId, {
            title: opts?.title,
            message: opts?.message,
            accountName: opts?.accountName,
          });
        },
      }).getSourceCredentials(src.id, {
        title: 'Test Decrypt',
        message: 'Enter passphrase to test',
      });
      if (__DEV__) console.log('[dev] creds ok, server', creds.server);
      const client = new XtreamClient({
        server: creds.server,
        username: creds.username,
        password: creds.password,
      });
      const builder = client.url;
      const href =
        action === 'get_live_categories'
          ? builder.getLiveCategories()
          : action === 'get_vod_categories'
            ? builder.getVodCategories()
            : builder.getSeriesCategories();
      if (__DEV__) console.log('[dev] GET', action, href);
      const res = await fetch(href);
      const text = await res.text();
      if (__DEV__)
        console.log('[dev] RESP', action, res.status, text.slice(0, 300));
    } catch (err: any) {
      if (__DEV__) console.log('[dev] ERR', action, err?.message || err);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
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

        {__DEV__ && sources.length > 0 && (
          <View className="px-6 mb-2">
            <Text className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
              Dev: Test category endpoints (first source)
            </Text>
            <View className="flex-row gap-2">
              <Pressable
                className="rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700"
                onPress={() => testCats('get_live_categories')}
              >
                <Text className="text-neutral-900 dark:text-neutral-50">
                  Live cats
                </Text>
              </Pressable>
              <Pressable
                className="rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700"
                onPress={() => testCats('get_vod_categories')}
              >
                <Text className="text-neutral-900 dark:text-neutral-50">
                  VOD cats
                </Text>
              </Pressable>
              <Pressable
                className="rounded-xl border border-neutral-300 px-3 py-2 dark:border-neutral-700"
                onPress={() => testCats('get_series_categories')}
              >
                <Text className="text-neutral-900 dark:text-neutral-50">
                  Series cats
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <View className="px-6">
          {sources.length === 0 ? (
            <Text className="text-neutral-600 dark:text-neutral-400">
              No playlists yet.
            </Text>
          ) : (
            sources.map(
              (s: { id: string; name: string; provider_type: string }) => (
                <PlaylistCard
                  key={s.id}
                  id={s.id}
                  name={s.name}
                  providerType={s.provider_type}
                  channels={stats[s.id]?.channels}
                  isLoading={reloadIsLoading}
                  isActiveReload={reloadingId === s.id}
                  onReload={(id) => {
                    if (__DEV__) console.log('[ui] click reload', id);
                    void reloadSource(id);
                  }}
                />
              )
            )
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
