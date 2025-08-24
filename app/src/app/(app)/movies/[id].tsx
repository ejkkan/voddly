import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { useFetchRemoteMovie } from '@/hooks/useFetchRemoteMovie';
import { useSourceBaseUrl } from '@/hooks/useSourceInfo';
import { getApiRoot } from '@/lib/auth/auth-client';
import { openDb } from '@/lib/db';
import { useSourceCredentials } from '@/lib/source-credentials';
import { normalizeImageUrl } from '@/lib/url-utils';

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
  tmdb_id?: string | null;
  original_payload_json?: string | null;
};

export default function MovieDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ItemRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { prepareContentPlayback } = useSourceCredentials();
  const { fetchRemote, isFetching, error: fetchError } = useFetchRemoteMovie();
  const lastFetchedTmdbRef = useRef<string | null>(null);
  const baseApi = getApiRoot();
  const sourceBase = useSourceBaseUrl(item?.source_id);
  console.log('[normalizedBackdrop] sourceBase', sourceBase);
  const normalizedBackdrop = useMemo(() => {
    console.log('[normalizedBackdrop] item', JSON.stringify(item, null, 2));
    if (!item) return null;
    const base =
      ((item as any).base_url as string | undefined) ||
      (sourceBase.baseUrl as string | undefined);
    return normalizeImageUrl(
      item.backdrop_url || item.poster_url || null,
      base
    );
  }, [item, sourceBase.baseUrl]);
  console.log('[normalizedBackdrop] normalizedBackdrop', normalizedBackdrop);
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
          `SELECT i.*, s.base_url FROM content_items i LEFT JOIN sources s ON s.id = i.source_id WHERE i.id = $id`,
          { $id: String(id) }
        );
        if (mounted) setItem(row ?? null);
        if (mounted) setLoading(false);
        if (row) {
          // Trigger metadata fetch by TMDB if available (from column or payload)
          try {
            const fromCol = String((row as any)?.tmdb_id || '').trim();
            const fromPayload = (() => {
              try {
                const raw = row?.original_payload_json
                  ? JSON.parse(String(row.original_payload_json))
                  : null;
                const info = raw?.info || {};
                return String(info?.tmdb_id ?? info?.tmdb ?? '').trim();
              } catch {
                return '';
              }
            })();
            const tmdb = fromCol || fromPayload;
            if (tmdb && lastFetchedTmdbRef.current !== tmdb) {
              lastFetchedTmdbRef.current = tmdb;
              const url = `${baseApi}/user/metadata?tmdb_id=${encodeURIComponent(tmdb)}&content_type=movie&append_to_response=${encodeURIComponent('videos,images,credits,external_ids')}`;
              fetch(url, { method: 'GET', credentials: 'include' })
                .then((r) => r.json())
                .then((j) => console.log('[Metadata fetched]', j))
                .catch(() => {});
            }
          } catch {}
          fetchRemote({
            id: row.id,
            sourceId: row.source_id,
            sourceItemId: row.source_item_id,
          }).then(async (ok) => {
            try {
              if (!ok || !mounted) return;
              const db2 = await openDb();
              const updated = await db2.getFirstAsync<
                ItemRow & { base_url?: string | null }
              >(
                `SELECT i.*, s.base_url FROM content_items i LEFT JOIN sources s ON s.id = i.source_id WHERE i.id = $id`,
                { $id: String(row.id) }
              );
              if (mounted) setItem(updated ?? row);
              // After background update, try metadata if tmdb_id became available
              try {
                const tmdbPost = String((updated as any)?.tmdb_id || '').trim();
                if (tmdbPost && lastFetchedTmdbRef.current !== tmdbPost) {
                  lastFetchedTmdbRef.current = tmdbPost;
                  const url = `${baseApi}/user/metadata?tmdb_id=${encodeURIComponent(tmdbPost)}&content_type=movie&append_to_response=${encodeURIComponent('videos,images,credits,external_ids')}`;
                  fetch(url, { method: 'GET', credentials: 'include' })
                    .then((r) => r.json())
                    .then((j) => console.log('[Metadata fetched]', j))
                    .catch(() => {});
                }
              } catch {}
            } catch {
              // ignore refresh errors
            }
          });
        }
      } finally {
        // done
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
      const movieId = item.source_item_id;
      await prepareContentPlayback({
        sourceId,
        contentId: movieId,
        contentType: 'movie',
        options: {
          title: 'Play Movie',
          message: 'Enter your passphrase to play the movie',
        },
      });
      router.push({
        pathname: '/(app)/player',
        params: { playlist: sourceId, movie: String(movieId) },
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
                {normalizedBackdrop ? (
                  <Image
                    source={{ uri: normalizedBackdrop || '' }}
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
                      const movieExt = await db.getFirstAsync<any>(
                        `SELECT * FROM movies_ext WHERE item_id = $id`,
                        { $id: String(item.id) }
                      );
                      console.log('[Movie DB]', { base, movieExt });
                    } catch (e) {
                      console.log('Log DB (movie) failed', e);
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
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
