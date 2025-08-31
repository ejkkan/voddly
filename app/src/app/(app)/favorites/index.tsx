import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';

import { PosterCard } from '@/components/media/poster-card';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { useFavoriteManager } from '@/hooks/ui';
import { usePlaylistManager } from '@/hooks/ui/usePlaylistManager';
import { useFavorites } from '@/hooks/useFavorites';
import { openDb } from '@/lib/db';
import { useSourceCredentials } from '@/lib/source-credentials';

type FavoriteItem = {
  content_id: string;
  content_type:
    | 'movie'
    | 'series'
    | 'tv'
    | 'category'
    | 'channel'
    | 'episode'
    | null;
  added_at: string;
};

type UiItem = {
  id: string;
  type: 'movie' | 'series' | 'live';
  title: string;
  imageUrl?: string | null;
};

type EpisodeUiItem = {
  id: string; // episodes_ext.id
  title: string;
  imageUrl?: string | null;
  sourceId: string;
  streamId: string;
};

type CategoryRow = { id: string; name: string; type: string };

// Helper to resolve content_items rows for a list of IDs
function useResolveItems(ids: string[], type: 'movie' | 'series' | 'tv') {
  const [items, setItems] = useState<UiItem[]>([]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        if (ids.length === 0) {
          if (mounted) setItems([]);
          return;
        }
        const db = await openDb();
        const placeholders = ids.map(() => '?').join(',');
        const rows = await db.getAllAsync<any>(
          `SELECT id, title, poster_url, backdrop_url, type
           FROM content_items
           WHERE id IN (${placeholders}) AND type = ?`,
          [...ids, type === 'tv' ? 'live' : type]
        );
        if (!mounted) return;
        setItems(
          rows.map((r: any) => ({
            id: r.id,
            type: r.type,
            title: r.title,
            imageUrl: r.poster_url || r.backdrop_url || null,
          }))
        );
      } catch (e) {
        console.warn('Failed to resolve items', e);
        if (mounted) setItems([]);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [ids.join(','), type]);

  return items;
}

// Resolve episode favorites into UI items with playback data
function useResolveEpisodes(ids: string[]) {
  const [items, setItems] = useState<EpisodeUiItem[]>([]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        if (ids.length === 0) {
          if (mounted) setItems([]);
          return;
        }
        const db = await openDb();
        const placeholders = ids.map(() => '?').join(',');
        const eps = await db.getAllAsync<any>(
          `SELECT id, series_item_id, season_number, episode_number, title, stream_id, original_payload_json
           FROM episodes_ext
           WHERE id IN (${placeholders})`,
          ids
        );
        if (!mounted) return;
        const seriesIds = Array.from(
          new Set((eps || []).map((e: any) => String(e.series_item_id)))
        );
        let seriesRows: any[] = [];
        if (seriesIds.length > 0) {
          const sPlace = seriesIds.map(() => '?').join(',');
          seriesRows = await db.getAllAsync<any>(
            `SELECT id, title, poster_url, backdrop_url, source_id
             FROM content_items
             WHERE id IN (${sPlace}) AND type = 'series'`,
            seriesIds
          );
        }
        const seriesMap = new Map<string, any>();
        for (const s of seriesRows) seriesMap.set(String(s.id), s);
        const toItems: EpisodeUiItem[] = (eps || []).map((e: any) => {
          const s = seriesMap.get(String(e.series_item_id));
          const title = (
            e.title && String(e.title).trim().length > 0
              ? String(e.title)
              : `S${String(e.season_number).padStart(2, '0')}E${String(e.episode_number).padStart(2, '0')}`
          ) as string;
          const imageUrl = s?.poster_url || s?.backdrop_url || null;
          const sourceId = s?.source_id ? String(s.source_id) : '';
          const streamId = e.stream_id
            ? String(e.stream_id)
            : `${e.series_item_id}:${e.season_number}:${e.episode_number}`;
          return {
            id: String(e.id),
            title,
            imageUrl,
            sourceId,
            streamId,
          };
        });
        setItems(toItems);
      } catch (e) {
        console.warn('Failed to resolve episodes', e);
        if (mounted) setItems([]);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [ids.join(',')]);

  return items;
}

// Resolve categories
function useResolveCategories(ids: string[]) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        if (ids.length === 0) {
          if (mounted) setCategories([]);
          return;
        }
        const db = await openDb();
        const placeholders = ids.map(() => '?').join(',');
        const rows = await db.getAllAsync<CategoryRow>(
          `SELECT id, name, type FROM categories WHERE id IN (${placeholders})`,
          ids
        );
        if (mounted) setCategories(rows || []);
      } catch (e) {
        console.warn('Failed to read categories', e);
        if (mounted) setCategories([]);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [ids.join(',')]);

  return categories;
}

export default function FavoritesPage() {
  const router = useRouter();
  const { isFavorite, toggleFavorite, profileId } = useFavoriteManager();
  const { isInAnyPlaylist } = usePlaylistManager();
  const { prepareContentPlayback } = useSourceCredentials();
  const favoritesQuery = useFavorites(profileId);
  const loading = favoritesQuery.isLoading;
  const favorites = (favoritesQuery.data?.items ?? []) as FavoriteItem[];

  // Partition favorites by type
  const byType = useMemo(() => {
    const result = {
      movie: [] as FavoriteItem[],
      series: [] as FavoriteItem[],
      episode: [] as FavoriteItem[],
      tv: [] as FavoriteItem[],
      category: [] as FavoriteItem[],
      channel: [] as FavoriteItem[],
    };
    for (const f of favorites) {
      if (!f.content_type) continue;
      if ((result as any)[f.content_type])
        (result as any)[f.content_type].push(f);
    }
    return result;
  }, [favorites]);

  const movieIds = useMemo(
    () => byType.movie.map((f) => f.content_id),
    [byType.movie]
  );
  const movieItems = useResolveItems(movieIds, 'movie');

  const seriesIds = useMemo(
    () => byType.series.map((f) => f.content_id),
    [byType.series]
  );
  const seriesItems = useResolveItems(seriesIds, 'series');

  const liveIds = useMemo(() => {
    const merged = [
      ...byType.tv.map((f) => f.content_id),
      ...byType.channel.map((f) => f.content_id),
    ];
    // de-duplicate
    return Array.from(new Set(merged));
  }, [byType.tv, byType.channel]);
  const liveItems = useResolveItems(liveIds, 'tv');

  const episodeIds = useMemo(
    () => byType.episode.map((f) => f.content_id),
    [byType.episode]
  );
  const episodeItems = useResolveEpisodes(episodeIds);

  // Categories need names from categories table
  const categoryIds = useMemo(
    () => byType.category.map((f) => f.content_id),
    [byType.category]
  );
  const categories = useResolveCategories(categoryIds);

  // Channels are favorited by UUID; we store live channels in content_items by item id.
  // The list above (liveItems) already covers rendering, so we don't need a separate channel section.

  const handleOpen = (item: UiItem) => {
    if (item.type === 'movie') {
      router.push(`/(app)/movies/${encodeURIComponent(item.id)}`);
    } else if (item.type === 'series') {
      router.push(`/(app)/series/${encodeURIComponent(item.id)}`);
    } else {
      router.push(`/(app)/tv/${encodeURIComponent(item.id)}`);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            Favorites
          </Text>
          {!loading && favorites.length === 0 ? (
            <Text className="mt-2 text-neutral-600 dark:text-neutral-400">
              No favorites yet
            </Text>
          ) : null}
        </View>

        {/* Movies */}
        {movieItems.length > 0 && (
          <View className="p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                Movies
              </Text>
            </View>
            <View className="flex-row flex-wrap">
              {movieItems.map((m) => (
                <View
                  key={m.id}
                  className="w-1/2 p-2 sm:w-1/3 md:w-1/4 lg:w-1/5 xl:w-1/6"
                >
                  <PosterCard
                    id={m.id}
                    title={m.title}
                    posterUrl={m.imageUrl}
                    onPress={() => handleOpen(m)}
                    isFavorite={isFavorite(m.id)}
                    onToggleFavorite={() => toggleFavorite(m.id, 'movie')}
                    isInPlaylist={isInAnyPlaylist(m.id)}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Series */}
        {seriesItems.length > 0 && (
          <View className="p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                Series
              </Text>
            </View>
            <View className="flex-row flex-wrap">
              {seriesItems.map((s) => (
                <View
                  key={s.id}
                  className="w-1/2 p-2 sm:w-1/3 md:w-1/4 lg:w-1/5 xl:w-1/6"
                >
                  <PosterCard
                    id={s.id}
                    title={s.title}
                    posterUrl={s.imageUrl}
                    onPress={() => handleOpen(s)}
                    isFavorite={isFavorite(s.id)}
                    onToggleFavorite={() => toggleFavorite(s.id, 'series')}
                    isInPlaylist={isInAnyPlaylist(s.id)}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Episodes */}
        {episodeItems.length > 0 && (
          <View className="p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                Episodes
              </Text>
            </View>
            <View className="flex-row flex-wrap">
              {episodeItems.map((ep) => (
                <View
                  key={ep.id}
                  className="w-1/2 p-2 sm:w-1/3 md:w-1/4 lg:w-1/5 xl:w-1/6"
                >
                  <PosterCard
                    id={ep.id}
                    title={ep.title}
                    posterUrl={ep.imageUrl}
                    onPress={async () => {
                      try {
                        if (!ep.sourceId) return;
                        await prepareContentPlayback({
                          sourceId: ep.sourceId,
                          contentId: ep.streamId,
                          contentType: 'series',
                        });
                        router.push({
                          pathname: '/(app)/player',
                          params: {
                            playlist: ep.sourceId,
                            series: ep.streamId,
                          },
                        });
                      } catch (error) {
                        console.error(
                          'Failed to play favorite episode:',
                          error
                        );
                      }
                    }}
                    isFavorite={isFavorite(ep.id)}
                    onToggleFavorite={() => toggleFavorite(ep.id, 'episode')}
                    isInPlaylist={isInAnyPlaylist(ep.id)}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Live TV (channels) */}
        {liveItems.length > 0 && (
          <View className="p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                Live TV
              </Text>
            </View>
            <View className="flex-row flex-wrap">
              {liveItems.map((c) => (
                <View
                  key={c.id}
                  className="w-1/2 p-2 sm:w-1/3 md:w-1/4 lg:w-1/5 xl:w-1/6"
                >
                  <PosterCard
                    id={c.id}
                    title={c.title}
                    posterUrl={c.imageUrl}
                    onPress={() => handleOpen(c)}
                    isFavorite={isFavorite(c.id)}
                    onToggleFavorite={() => toggleFavorite(c.id, 'tv')}
                    isInPlaylist={isInAnyPlaylist(c.id)}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <View className="p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                Categories
              </Text>
            </View>
            <View className="flex-row flex-wrap">
              {categories.map((cat) => (
                <View
                  key={cat.id}
                  className="w-1/2 p-2 sm:w-1/3 md:w-1/4 lg:w-1/5 xl:w-1/6"
                >
                  <Pressable
                    onPress={() =>
                      router.push(
                        `/(app)/category/${encodeURIComponent(cat.id)}`
                      )
                    }
                    className="mr-3"
                  >
                    <View className="relative overflow-hidden rounded-xl">
                      <View className="h-40 items-center justify-center rounded-xl bg-neutral-200 dark:bg-neutral-800">
                        <Text
                          className="px-2 text-center text-neutral-800 dark:text-neutral-200"
                          numberOfLines={2}
                        >
                          {cat.name}
                        </Text>
                      </View>
                    </View>
                    <Text
                      numberOfLines={1}
                      className="mt-2 w-36 text-sm text-neutral-900 dark:text-white md:w-44 lg:w-48"
                    >
                      {cat.type === 'vod'
                        ? 'Movies'
                        : cat.type === 'series'
                          ? 'Series'
                          : 'Live'}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
