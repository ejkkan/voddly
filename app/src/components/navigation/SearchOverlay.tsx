import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView } from 'react-native';

import { CarouselRow } from '@/components/media/carousel-row';
import { PosterCard } from '@/components/media/poster-card';
import { Pressable, Text, View } from '@/components/ui';
import { useSearch } from '@/contexts/SearchContext';
import { useFavoriteManager } from '@/hooks/ui';
import { usePlaylistManager } from '@/hooks/ui/usePlaylistManager';
import { searchCatalog } from '@/lib/db/dao';

type BasicItem = {
  id: string;
  source_id: string;
  type: 'movie' | 'series' | 'tv';
  title: string;
  poster_url?: string | null;
  tmdb_id?: string | null;
};

export function SearchOverlay() {
  const { searchQuery, isSearchOpen, closeSearch } = useSearch();

  const router = useRouter();
  const { isFavorite, toggleFavorite, hasProfile } = useFavoriteManager();
  const { isInAnyPlaylist } = usePlaylistManager();

  const [results, setResults] = useState<{
    movies: BasicItem[];
    series: BasicItem[];
    live: BasicItem[];
    replays: BasicItem[];
  }>({
    movies: [],
    series: [],
    live: [],
    replays: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const trimmed = useMemo(() => searchQuery.trim(), [searchQuery]);

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!trimmed) {
      setResults({ movies: [], series: [], live: [], replays: [] });
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const [moviesRaw, series, live] = await Promise.all([
          searchCatalog(trimmed, 'movie') as Promise<BasicItem[]>,
          searchCatalog(trimmed, 'series') as Promise<BasicItem[]>,
          searchCatalog(trimmed, 'live') as Promise<BasicItem[]>,
        ]);
        const isMissingTmdb = (v?: string | null) => {
          const s = String(v ?? '').trim();
          return !s || s === '0';
        };
        const replays = moviesRaw.filter((m) =>
          isMissingTmdb((m as any).tmdb_id)
        );
        const movies = moviesRaw.filter(
          (m) => !isMissingTmdb((m as any).tmdb_id)
        );
        setResults({ movies, series, live, replays });
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [trimmed]);

  const handlePress = (item: BasicItem) => {
    closeSearch(); // Close search when navigating
    if (item.type === 'movie') {
      router.push(`/(app)/movies/${encodeURIComponent(String(item.id))}`);
      return;
    }
    if (item.type === 'series') {
      router.push(`/(app)/series/${encodeURIComponent(String(item.id))}`);
      return;
    }
    if (item.type === 'live') {
      router.push(`/(app)/tv/${encodeURIComponent(String(item.id))}`);
      return;
    }
  };

  if (!isSearchOpen) return null;

  return (
    <View
      className="fixed inset-0 z-[60] bg-black/60"
      style={{
        backdropFilter: Platform.OS === 'web' ? 'blur(20px)' : undefined,
        WebkitBackdropFilter: Platform.OS === 'web' ? 'blur(20px)' : undefined,
      }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: 24,
          paddingLeft: 100,
          paddingTop: 100,
        }}
      >
        <View className="px-4">
          {/* Header */}
          <View className="mb-6 flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-white">
              {searchQuery ? `Search Results` : 'Start typing to search'}
            </Text>
            <Pressable
              onPress={closeSearch}
              className="rounded-lg p-2 hover:bg-white/10"
            >
              <X size={24} color="#fff" />
            </Pressable>
          </View>

          {isSearching ? (
            <Text className="mb-4 text-sm text-gray-400">Searching…</Text>
          ) : null}
        </View>

        {/* Movies Section */}
        {results.movies.length > 0 ? (
          <View className="mt-4">
            <CarouselRow
              title="Movies"
              data={results.movies.map(
                (i) =>
                  ({
                    id: i.id,
                    title: i.title,
                    imageUrl: i.poster_url || undefined,
                    sourceId: i.source_id,
                  }) as any
              )}
              renderItem={(row) => (
                <PosterCard
                  id={row.id}
                  title={row.title}
                  posterUrl={row.imageUrl}
                  onPress={() =>
                    handlePress(
                      results.movies.find(
                        (m) => String(m.id) === String(row.id)
                      )!
                    )
                  }
                  isFavorite={isFavorite(row.id)}
                  onToggleFavorite={() => toggleFavorite(row.id, 'movie')}
                  hasProfile={hasProfile}
                  isInPlaylist={isInAnyPlaylist(row.id)}
                />
              )}
            />
          </View>
        ) : null}

        {/* Series Section */}
        {results.series.length > 0 ? (
          <View className="mt-2">
            <CarouselRow
              title="Series"
              data={results.series.map(
                (i) =>
                  ({
                    id: i.id,
                    title: i.title,
                    imageUrl: i.poster_url || undefined,
                    sourceId: i.source_id,
                  }) as any
              )}
              renderItem={(row) => (
                <PosterCard
                  id={row.id}
                  title={row.title}
                  posterUrl={row.imageUrl}
                  onPress={() =>
                    handlePress(
                      results.series.find(
                        (m) => String(m.id) === String(row.id)
                      )!
                    )
                  }
                  isFavorite={isFavorite(row.id)}
                  onToggleFavorite={() => toggleFavorite(row.id, 'series')}
                  hasProfile={hasProfile}
                  isInPlaylist={isInAnyPlaylist(row.id)}
                />
              )}
            />
          </View>
        ) : null}

        {/* Live TV Section */}
        {results.live.length > 0 ? (
          <View className="mt-2">
            <CarouselRow
              title="TV"
              data={results.live.map(
                (i) =>
                  ({
                    id: i.id,
                    title: i.title,
                    imageUrl: i.poster_url || undefined,
                    sourceId: i.source_id,
                  }) as any
              )}
              renderItem={(row) => (
                <PosterCard
                  id={row.id}
                  title={row.title}
                  posterUrl={row.imageUrl}
                  onPress={() =>
                    handlePress(
                      results.live.find((m) => String(m.id) === String(row.id))!
                    )
                  }
                  isFavorite={isFavorite(row.id)}
                  onToggleFavorite={() => toggleFavorite(row.id, 'tv')}
                  hasProfile={hasProfile}
                  isInPlaylist={isInAnyPlaylist(row.id)}
                />
              )}
            />
          </View>
        ) : null}

        {/* Replays Section */}
        {results.replays.length > 0 ? (
          <View className="mt-4">
            <CarouselRow
              title="Replays"
              data={results.replays.map(
                (i) =>
                  ({
                    id: i.id,
                    title: i.title,
                    imageUrl: i.poster_url || undefined,
                    sourceId: i.source_id,
                  }) as any
              )}
              renderItem={(row) => (
                <PosterCard
                  id={row.id}
                  title={row.title}
                  posterUrl={row.imageUrl}
                  onPress={() =>
                    handlePress(
                      results.replays.find(
                        (m) => String(m.id) === String(row.id)
                      )!
                    )
                  }
                  isFavorite={isFavorite(row.id)}
                  onToggleFavorite={() => toggleFavorite(row.id)}
                  hasProfile={hasProfile}
                  isInPlaylist={isInAnyPlaylist(row.id)}
                />
              )}
            />
          </View>
        ) : null}

        {/* No Results */}
        {!isSearching &&
        trimmed &&
        results.movies.length === 0 &&
        results.series.length === 0 &&
        results.live.length === 0 ? (
          <View className="px-6 py-8">
            <Text className="text-gray-400">
              No results found for "{searchQuery}".
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
