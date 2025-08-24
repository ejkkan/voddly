import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  SafeAreaView,
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
} from '@/components/ui';
import { useSourceCredentials } from '@/lib/source-credentials';
import { openDb } from '@/lib/db';
import { useFetchRemoteLive } from '@/hooks/useFetchRemoteLive';
import { normalizeImageUrl } from '@/lib/url-utils';
import { useSourceBaseUrl } from '@/hooks/useSourceInfo';

type ItemRow = {
  id: string;
  source_id: string;
  source_item_id: string;
  type: string;
  title: string;
  poster_url?: string | null;
  rating?: number | null;
};

export default function LiveDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ItemRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { prepareContentPlayback } = useSourceCredentials();
  const { fetchRemote, isFetching, error: fetchError } = useFetchRemoteLive();
  const sourceBase = useSourceBaseUrl(item?.source_id);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        if (!id) {
          if (mounted) setLoading(false);
          return;
        }
        const db = await openDb();
        const row = await db.getFirstAsync<
          ItemRow & { base_url?: string | null }
        >(
          `SELECT i.id, i.source_id, i.source_item_id, i.type, i.title, i.poster_url, i.rating, s.base_url FROM content_items i LEFT JOIN sources s ON s.id = i.source_id WHERE i.id = $id`,
          { $id: String(id) }
        );
        if (mounted) setItem(row ?? null);
        if (mounted) setLoading(false);
        if (row) {
          // Background refresh
          fetchRemote({
            id: row.id,
            sourceId: row.source_id,
            sourceItemId: row.source_item_id,
          }).then(async (ok) => {
            try {
              if (!ok || !mounted) return;
              const db2 = await openDb();
              const updated = await db2.getFirstAsync<ItemRow>(
                `SELECT id, source_id, source_item_id, type, title, poster_url, rating FROM content_items WHERE id = $id`,
                { $id: String(row.id) }
              );
              if (mounted) setItem(updated ?? row);
            } catch {
              // ignore refresh errors
            }
          });
        }
      } finally {
        // loading ended after local read
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handlePlay = async () => {
    try {
      if (!item) return;
      const sourceId = item.source_id;
      const channelId = item.source_item_id;
      await prepareContentPlayback({
        sourceId,
        contentId: channelId,
        contentType: 'live',
        options: {
          title: 'Play Channel',
          message: 'Enter your passphrase to play the channel',
        },
      });
      router.push({
        pathname: '/(app)/player',
        params: { playlist: sourceId, live: String(channelId) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to prepare playback');
    }
  };

  return (
    <SafeAreaView className="flex-1">
      <ScrollView className="flex-1 bg-white dark:bg-black">
        <View className="p-4">
          <Pressable className="mb-3" onPress={() => router.back()}>
            <Text className="text-neutral-600 dark:text-neutral-300">Back</Text>
          </Pressable>
          {loading ? (
            <Text className="text-neutral-900 dark:text-neutral-50">
              Loading…
            </Text>
          ) : !item ? (
            <Text className="text-neutral-900 dark:text-neutral-50">
              Not found
            </Text>
          ) : (
            <View>
              <View className="overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-900">
                {(() => {
                  const base =
                    ((item as any).base_url as string | undefined) ||
                    (sourceBase.baseUrl as string | undefined);
                  const normalized = normalizeImageUrl(
                    item.poster_url || null,
                    base
                  );
                  if (!normalized) return null;
                  return (
                    <Image
                      source={{ uri: normalized }}
                      contentFit="cover"
                      className="h-40 w-full md:h-56"
                    />
                  );
                })()}
              </View>
              <Text className="mt-4 text-2xl font-extrabold text-neutral-900 dark:text-neutral-50">
                {item.title}
              </Text>
              <View className="mt-2 flex-row items-center gap-2">
                {typeof item.rating === 'number' ? (
                  <Text className="text-neutral-600 dark:text-neutral-400">
                    ⭐ {item.rating}
                  </Text>
                ) : null}
              </View>
              <View className="mt-4 flex-row gap-3">
                <Pressable
                  className="rounded-xl bg-neutral-900 px-4 py-2"
                  onPress={handlePlay}
                >
                  <Text className="text-white">Start Watching</Text>
                </Pressable>
                <Pressable
                  className="rounded-xl border border-neutral-300 px-4 py-2 dark:border-neutral-700"
                  onPress={async () => {
                    if (!item) return;
                    const ok = await fetchRemote({
                      id: item.id,
                      sourceId: item.source_id,
                      sourceItemId: item.source_item_id,
                    });
                    if (ok) {
                      const db = await openDb();
                      const row = await db.getFirstAsync<ItemRow>(
                        `SELECT id, source_id, source_item_id, type, title, poster_url, rating FROM content_items WHERE id = $id`,
                        { $id: String(item.id) }
                      );
                      setItem(row ?? null);
                    }
                  }}
                >
                  <Text className="text-neutral-900 dark:text-neutral-50">
                    {isFetching ? 'Fetching…' : 'Fetch Remote'}
                  </Text>
                </Pressable>
                <Pressable
                  className="rounded-xl border border-neutral-300 px-4 py-2 dark:border-neutral-700"
                  onPress={async () => {
                    try {
                      if (!item) return;
                      const db = await openDb();
                      const base = await db.getFirstAsync<any>(
                        `SELECT * FROM content_items WHERE id = $id`,
                        { $id: String(item.id) }
                      );
                      const liveExt = await db.getFirstAsync<any>(
                        `SELECT * FROM live_ext WHERE item_id = $id`,
                        { $id: String(item.id) }
                      );
                      console.log('[Live DB]', { base, liveExt });
                    } catch (e) {
                      console.log('Log DB (live) failed', e);
                    }
                  }}
                >
                  <Text className="text-neutral-900 dark:text-neutral-50">
                    Log from DB
                  </Text>
                </Pressable>
              </View>
              {error ? (
                <Text className="mt-2 text-red-600 dark:text-red-400">
                  {error}
                </Text>
              ) : null}
              {fetchError ? (
                <Text className="mt-2 text-red-600 dark:text-red-400">
                  {fetchError}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
