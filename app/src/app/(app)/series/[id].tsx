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
import { useFetchRemoteSeries } from '@/hooks/useFetchRemoteSeries';
import { SeriesEpisodesCarousels } from '@/components/series/SeriesEpisodesCarousels';
import { SeasonsList } from '@/components/series/SeasonsList';

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
  last_modified?: string | null;
  original_payload_json?: string | null;
};

export default function SeriesDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ItemRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [episodesRefreshKey, setEpisodesRefreshKey] = useState(0);
  const { prepareContentPlayback } = useSourceCredentials();
  const { fetchRemote, isFetching, error: fetchError } = useFetchRemoteSeries();

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
        if (row) {
          // Fetch remote in the background and refresh when done
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
              if (mounted) setEpisodesRefreshKey((v) => v + 1);
            } catch {
              // ignore refresh errors (e.g., DB closed during navigation)
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
      const seriesId = item.source_item_id;
      await prepareContentPlayback(sourceId, seriesId, 'series', {
        title: 'Play Series',
        message: 'Enter your passphrase to play the first episode',
      });
      router.push({
        pathname: '/(app)/player',
        params: { playlist: sourceId, series: String(seriesId) },
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
              <View className="mt-4 flex-row gap-3">
                <Pressable
                  className="rounded-xl bg-neutral-900 px-4 py-2"
                  onPress={handlePlay}
                >
                  <Text className="text-white">Play</Text>
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
                        `SELECT * FROM content_items WHERE id = $id`,
                        { $id: String(item.id) }
                      );
                      setItem(row ?? null);
                      setEpisodesRefreshKey((v) => v + 1);
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
                      const seriesExt = await db.getFirstAsync<any>(
                        `SELECT * FROM series_ext WHERE item_id = $id`,
                        { $id: String(item.id) }
                      );
                      const episodesSample = await db.getAllAsync<any>(
                        `SELECT id, season_number, episode_number, stream_id, container_extension FROM episodes_ext WHERE series_item_id = $id ORDER BY season_number ASC, episode_number ASC LIMIT 5`,
                        { $id: String(item.id) }
                      );
                      const episodesCountRow = await db.getFirstAsync<any>(
                        `SELECT COUNT(1) as cnt FROM episodes_ext WHERE series_item_id = $id`,
                        { $id: String(item.id) }
                      );
                      console.log('[Series DB]', {
                        base,
                        seriesExt,
                        episodesCount: episodesCountRow?.cnt ?? 0,
                        episodesSample,
                      });
                    } catch (e) {
                      console.log('Log DB (series) failed', e);
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
              {item.description ? (
                <Text className="mt-3 text-neutral-800 dark:text-neutral-200">
                  {item.description}
                </Text>
              ) : null}
              {item?.original_payload_json
                ? (() => {
                    try {
                      const raw = JSON.parse(
                        item.original_payload_json || '{}'
                      );
                      const info = raw?.info || {};
                      const plot = info?.plot;
                      const genre = info?.genre;
                      const cast = info?.cast;
                      const director = info?.director;
                      const episodeRunTime = info?.episode_run_time;
                      return (
                        <View className="mt-4 gap-2">
                          {!item.description && plot ? (
                            <Text className="text-neutral-700 dark:text-neutral-300">
                              {String(plot)}
                            </Text>
                          ) : null}
                          <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                            {episodeRunTime ? (
                              <Text className="text-neutral-600 dark:text-neutral-400">
                                Episode runtime: {String(episodeRunTime)} min
                              </Text>
                            ) : null}
                            {genre ? (
                              <Text className="text-neutral-600 dark:text-neutral-400">
                                Genre: {String(genre)}
                              </Text>
                            ) : null}
                          </View>
                          {cast ? (
                            <Text className="text-neutral-600 dark:text-neutral-400">
                              Cast: {String(cast)}
                            </Text>
                          ) : null}
                          {director ? (
                            <Text className="text-neutral-600 dark:text-neutral-400">
                              Director: {String(director)}
                            </Text>
                          ) : null}
                        </View>
                      );
                    } catch {
                      return null;
                    }
                  })()
                : null}
              {item ? (
                <SeasonsList seriesItemId={item.id} onSeasonPress={() => {}} />
              ) : null}
              {item ? (
                <SeriesEpisodesCarousels
                  seriesItemId={item.id}
                  sourceId={item.source_id}
                  refreshKey={episodesRefreshKey}
                />
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
