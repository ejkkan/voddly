import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { CarouselRow } from '@/components/media/carousel-row';
import { PosterCard } from '@/components/media/poster-card';
import { SafeAreaView, ScrollView, Text, View } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { searchCatalog } from '@/lib/db/dao';

type BasicItem = {
  id: string;
  source_id: string;
  type: 'movie' | 'series' | 'live';
  title: string;
  poster_url?: string | null;
  base_url?: string | null;
  tmdb_id?: string | null;
};

export default function Search() {
  const router = useRouter();
  const [query, setQuery] = useState('');
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

  const trimmed = useMemo(() => query.trim(), [query]);

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
    if (item.type === 'movie') {
      router.push(`/(app)/movies/${encodeURIComponent(String(item.id))}`);
      return;
    }
    if (item.type === 'series') {
      router.push(`/(app)/series/${encodeURIComponent(String(item.id))}`);
      return;
    }
    if (item.type === 'live') {
      router.push(`/(app)/live/${encodeURIComponent(String(item.id))}`);
      return;
    }
  };

  return (
    <SafeAreaView className="flex-1">
      <ScrollView
        className="flex-1 bg-white dark:bg-black"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="px-4 pt-4 md:px-6">
          <Text className="mb-3 text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            Search
          </Text>
          <Input
            placeholder="Search by name..."
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            testID="search-input"
          />
          {isSearching ? (
            <Text className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              Searching…
            </Text>
          ) : null}
        </View>

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
                  sourceId={(row as any).sourceId}
                  onPress={() =>
                    handlePress(
                      results.movies.find(
                        (m) => String(m.id) === String(row.id)
                      )!
                    )
                  }
                />
              )}
            />
          </View>
        ) : null}

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
                  sourceId={(row as any).sourceId}
                  onPress={() =>
                    handlePress(
                      results.series.find(
                        (m) => String(m.id) === String(row.id)
                      )!
                    )
                  }
                />
              )}
            />
          </View>
        ) : null}

        {results.live.length > 0 ? (
          <View className="mt-2">
            <CarouselRow
              title="Live"
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
                  sourceId={(row as any).sourceId}
                  onPress={() =>
                    handlePress(
                      results.live.find((m) => String(m.id) === String(row.id))!
                    )
                  }
                />
              )}
            />
          </View>
        ) : null}

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
                  sourceId={(row as any).sourceId}
                  onPress={() =>
                    handlePress(
                      results.replays.find(
                        (m) => String(m.id) === String(row.id)
                      )!
                    )
                  }
                />
              )}
            />
          </View>
        ) : null}

        {!isSearching &&
        trimmed &&
        results.movies.length === 0 &&
        results.series.length === 0 &&
        results.live.length === 0 ? (
          <View className="px-6 py-8">
            <Text className="text-neutral-600 dark:text-neutral-300">
              No results.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
