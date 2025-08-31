/* eslint-disable simple-import-sort/imports */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';

import { CarouselRow } from '@/components/media/carousel-row';
import { PosterCard } from '@/components/media/poster-card';
import { FlatList, Pressable, SafeAreaView, Text, View } from '@/components/ui';
import { Heart } from '@/components/ui/icons';
import { useUiSections, useFavoriteManager } from '@/hooks/ui';
import { fetchCategoriesWithPreviews } from '@/lib/db/ui';
import { useIsMoviesRoute } from '@/hooks/ui/useRouteActive';

type Section = {
  categoryId?: string;
  title: string;
  data: {
    id: string;
    title: string;
    imageUrl?: string | null;
    sourceId?: string;
  }[];
};

export default function VODs() {
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavoriteManager();
  const isMovies = useIsMoviesRoute();
  const [sections, setSections] = useState<Section[]>([]);
  const [catOffset, setCatOffset] = useState(0);
  const [loadingCats, setLoadingCats] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const loadingRowsRef = useRef<Record<string, boolean>>({});

  const sectionsQuery = useUiSections('movie', {
    limitPerCategory: 2,
    maxCategories: 4,
    categoryOffset: 1,
    enabled: isMovies, // Only run query when isMovies is true
  });

  useEffect(() => {
    // Only run this effect when isMovies is true
    if (!isMovies || sectionsQuery.isPending || sectionsQuery.isError) return;
    const cats = sectionsQuery.data || [];
    const mapped: Section[] = cats.map((c) => ({
      categoryId: c.categoryId,
      title: c.name,
      data: c.items.map((i) => ({
        id: i.id,
        title: i.title,
        imageUrl: i.imageUrl,
        sourceId: (i as any).sourceId,
      })),
    }));
    setSections(mapped);
    setCatOffset(mapped.length);
    setInitialLoaded(true);
  }, [
    isMovies,
    sectionsQuery.isPending,
    sectionsQuery.isError,
    sectionsQuery.data,
  ]);

  const loadMoreCategories = useCallback(async () => {
    // Only run when isMovies is true
    if (!isMovies || loadingCats || !initialLoaded) return;
    setLoadingCats(true);
    try {
      const cats = await fetchCategoriesWithPreviews('movie', 20, 5, catOffset);
      if (!cats || cats.length === 0) return;
      setSections((prev) =>
        prev.concat(
          cats.map((c) => ({
            categoryId: c.categoryId,
            title: c.name,
            data: c.items.map((i) => ({
              id: i.id,
              title: i.title,
              imageUrl: i.imageUrl,
            })),
          }))
        )
      );
      setCatOffset((o) => o + cats.length);
    } finally {
      setLoadingCats(false);
    }
  }, [isMovies, loadingCats, initialLoaded, catOffset]);

  const handleLoadMoreRow = useCallback(
    async (categoryId?: string) => {
      // Only run when isMovies is true
      if (!isMovies || !categoryId) return;
      if (loadingRowsRef.current[categoryId]) return;
      loadingRowsRef.current[categoryId] = true;
      try {
        const sectionIndex = sections.findIndex(
          (s) => s.categoryId === categoryId
        );
        if (sectionIndex === -1) return;
        const current = sections[sectionIndex];
        const { fetchCategoryItems } = await import('@/lib/db/ui');
        const more = await fetchCategoryItems(
          'movie',
          categoryId,
          25,
          current.data.length
        );
        if (!more || more.length === 0) return;
        setSections((prev) => {
          const copy = prev.slice();
          const target = copy[sectionIndex];
          copy[sectionIndex] = {
            ...target,
            data: target.data.concat(
              more.map((i) => ({
                id: i.id,
                title: i.title,
                imageUrl: i.imageUrl,
                sourceId: (i as any).sourceId,
              }))
            ),
          };
          return copy;
        });
      } finally {
        loadingRowsRef.current[categoryId] = false;
      }
    },
    [isMovies, sections]
  );

  return (
    <SafeAreaView className="flex-1">
      <FlatList
        data={sections}
        keyExtractor={(s, idx) => `${s.categoryId || s.title}-${idx}`}
        renderItem={({ item }) => (
          <CarouselRow
            title={item.title}
            data={item.data}
            titleAccessory={
              item.categoryId ? (
                <Pressable
                  onPress={() =>
                    toggleFavorite(item.categoryId as string, 'category')
                  }
                  className="rounded-full p-1"
                >
                  <Heart
                    filled={isFavorite(item.categoryId)}
                    color={isFavorite(item.categoryId) ? '#ef4444' : '#6b7280'}
                  />
                </Pressable>
              ) : null
            }
            onEndReached={() => handleLoadMoreRow(item.categoryId)}
            loadingMore={
              !!(item.categoryId && loadingRowsRef.current[item.categoryId])
            }
            renderItem={(row) => (
              <PosterCard
                id={row.id}
                title={row.title}
                posterUrl={row.imageUrl}
                onPress={(id) =>
                  router.push(`/(app)/movies/${encodeURIComponent(String(id))}`)
                }
                isFavorite={isFavorite(row.id)}
                onToggleFavorite={() => toggleFavorite(row.id, 'movie')}
              />
            )}
          />
        )}
        onEndReachedThreshold={0.6}
        onEndReached={loadMoreCategories}
        ListHeaderComponent={
          <View className="px-6 py-4">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
              Moviess
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        className="flex-1 bg-white dark:bg-black"
      />
    </SafeAreaView>
  );
}
