import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView, View, Text, FlatList } from '@/components/ui';
import { CarouselRow } from '@/components/media/carousel-row';
import { PosterCard } from '@/components/media/poster-card';
import {
  fetchCategoriesWithPreviews,
  backfillMissingItemCategories,
  fetchPreviewByType,
} from '@/lib/db/ui';

type Section = {
  categoryId?: string;
  title: string;
  data: Array<{ id: string; title: string; imageUrl?: string | null }>;
};

export default function Series() {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>([]);
  const [catOffset, setCatOffset] = useState(0);
  const [loadingCats, setLoadingCats] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const loadingRowsRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        // Fire-and-forget so we don't block initial UI render
        backfillMissingItemCategories().catch(() => {});
      } catch {}
      return fetchCategoriesWithPreviews('series', 10, 10, 0);
    };
    run()
      .then((cats) => {
        if (!mounted) return;
        const mapped: Section[] = cats.map((c) => ({
          categoryId: c.categoryId,
          title: c.name,
          data: c.items.map((i) => ({
            id: i.id,
            title: i.title,
            imageUrl: i.imageUrl,
          })),
        }));
        if (mapped.length === 0 || mapped.every((s) => s.data.length === 0)) {
          fetchPreviewByType('series', 10)
            .then((items) => {
              if (!mounted) return;
              setSections([
                {
                  title: 'Recently Added',
                  data: items.map((i) => ({
                    id: i.id,
                    title: i.title,
                    imageUrl: i.imageUrl,
                  })),
                },
              ]);
              setInitialLoaded(true);
            })
            .catch(() => setSections([]));
        } else {
          setSections(mapped);
          setCatOffset(10);
          setInitialLoaded(true);
        }
      })
      .catch(() => setSections([]));
    return () => {
      mounted = false;
    };
  }, []);
  const loadMoreCategories = useCallback(async () => {
    if (loadingCats || !initialLoaded) return;
    setLoadingCats(true);
    try {
      const cats = await fetchCategoriesWithPreviews(
        'series',
        10,
        5,
        catOffset
      );
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
  }, [loadingCats, initialLoaded, catOffset]);

  const handleLoadMoreRow = useCallback(
    async (categoryId?: string) => {
      if (!categoryId) return;
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
          'series',
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
              }))
            ),
          };
          return copy;
        });
      } finally {
        loadingRowsRef.current[categoryId] = false;
      }
    },
    [sections]
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
                  router.push(`/(app)/series/${encodeURIComponent(String(id))}`)
                }
              />
            )}
          />
        )}
        onEndReachedThreshold={0.6}
        onEndReached={loadMoreCategories}
        ListHeaderComponent={
          <View className="px-6 py-4">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
              Series
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        className="flex-1 bg-white dark:bg-black"
      />
    </SafeAreaView>
  );
}
