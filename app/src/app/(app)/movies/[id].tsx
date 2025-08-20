import React, { useEffect, useState } from 'react';
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
import { useFetchRemoteMovie } from '@/hooks/useFetchRemoteMovie';

type ItemRow = {
  id: string;
  source_id: string;
  source_item_id: string;
  type: string;
  title: string;
  description?: string | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
  release_date?: string | null;
  rating?: number | null;
  rating_5based?: number | null;
  original_payload_json?: string;
};

export default function MovieDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ItemRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { prepareContentPlayback } = useSourceCredentials();
  const {
    fetchRemote,
    isFetching: fetching,
    error: fetchError,
  } = useFetchRemoteMovie();

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
        const row = await db.getFirstAsync<ItemRow>(
          `SELECT * FROM content_items WHERE id = $id`,
          { $id: String(id) }
        );
        if (mounted) setItem(row ?? null);
        if (mounted) setLoading(false);
        // Fetch remote in background and refresh if changed
        if (row) {
          fetchRemote({
            id: row.id,
            sourceId: row.source_id,
            sourceItemId: row.source_item_id,
          }).then(async (ok) => {
            try {
              if (!ok || !mounted) return;
              const db2 = await openDb();
              const updated = await db2.getFirstAsync<ItemRow>(
                `SELECT * FROM content_items WHERE id = $id`,
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
      // source_id is of the form `${sourceId}:type:...` for content_items.id, but here we stored source_id as raw source id
      const sourceId = item.source_id;
      const sourceItemId = item.source_item_id;
      await prepareContentPlayback(sourceId, sourceItemId, 'movie', {
        title: 'Play Movie',
        message: 'Enter your passphrase to play the movie',
      });
      // Navigate to player route (to be implemented) with identifiers
      router.push({
        pathname: '/(app)/player',
        params: { playlist: sourceId, movie: String(sourceItemId) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to prepare playback');
    }
  };

  const handleFetchFresh = async () => {
    if (!item) return;
    const ok = await fetchRemote({
      id: item.id,
      sourceId: item.source_id,
      sourceItemId: item.source_item_id,
    });
    if (ok) {
      const db = await openDb();
      const row = await db.getFirstAsync<ItemRow>(
        `SELECT * FROM content_items WHERE id = $id`,
        { $id: String(item.id) }
      );
      setItem(row ?? null);
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
                {item.backdrop_url || item.poster_url ? (
                  <Image
                    source={{ uri: item.backdrop_url || item.poster_url || '' }}
                    contentFit="cover"
                    className="h-56 w-full md:h-72"
                  />
                ) : null}
              </View>
              <Text className="mt-4 text-2xl font-extrabold text-neutral-900 dark:text-neutral-50">
                {item.title}
              </Text>
              <View className="mt-2 flex-row items-center gap-2">
                {item.release_date ? (
                  <Text className="text-neutral-600 dark:text-neutral-400">
                    {String(item.release_date).slice(0, 4)}
                  </Text>
                ) : null}
                {typeof item.rating_5based === 'number' ? (
                  <Text className="text-neutral-600 dark:text-neutral-400">
                    • ⭐ {item.rating_5based}/5
                  </Text>
                ) : null}
                <Text className="text-neutral-600 dark:text-neutral-400">
                  • HD
                </Text>
              </View>
              {item.description ? (
                <Text className="mt-3 text-neutral-800 dark:text-neutral-200">
                  {item.description}
                </Text>
              ) : null}
              <View className="mt-4 flex-row gap-3">
                <Pressable
                  className="rounded-xl bg-neutral-900 px-4 py-2"
                  onPress={handlePlay}
                >
                  <Text className="text-white">Play</Text>
                </Pressable>
                <Pressable
                  className="rounded-xl border border-neutral-300 px-4 py-2 dark:border-neutral-700"
                  onPress={handleFetchFresh}
                >
                  <Text className="text-neutral-900 dark:text-neutral-50">
                    {fetching ? 'Fetching…' : 'Fetch Remote'}
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
              {/* Extra info from original payload if available */}
              {item.original_payload_json
                ? (() => {
                    try {
                      const raw = JSON.parse(
                        item.original_payload_json || '{}'
                      );
                      const duration = raw?.duration;
                      const genre = raw?.genre;
                      const plot = raw?.plot;
                      return (
                        <View className="mt-4 gap-2">
                          {plot ? (
                            <Text className="text-neutral-700 dark:text-neutral-300">
                              {plot}
                            </Text>
                          ) : null}
                          <View className="flex-row gap-3">
                            {duration ? (
                              <Text className="text-neutral-600 dark:text-neutral-400">
                                Duration: {String(duration)}
                              </Text>
                            ) : null}
                            {genre ? (
                              <Text className="text-neutral-600 dark:text-neutral-400">
                                Genre: {String(genre)}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    } catch {
                      return null;
                    }
                  })()
                : null}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
