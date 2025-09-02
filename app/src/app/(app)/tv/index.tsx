import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { CarouselRow } from '@/components/media/carousel-row';
import { PosterCard } from '@/components/media/poster-card';
import { FlatList, SafeAreaView, Text, View } from '@/components/ui';
import { useFavoriteManager, useUiPreview, useUiSections } from '@/hooks/ui';
import { getLocalItemData } from '@/hooks/ui/useDashboardTrends';
import { usePlaylistManager } from '@/hooks/ui/usePlaylistManager';
import { fetchCategoriesWithPreviews } from '@/lib/db/ui';
import { useActiveSubscriptionId } from '@/hooks/ui/useAccounts';

type Section = {
  categoryId?: string;
  title: string;
  data: {
    id: string;
    title: string;
    imageUrl?: string | null;
    sourceId?: string;
  }[];
  aspect?: 'poster' | 'backdrop';
};

export default function TV() {
  const router = useRouter();
  const { subscriptionId } = useActiveSubscriptionId();
  const { isFavorite, toggleFavorite, hasProfile } = useFavoriteManager();
  const { isInAnyPlaylist } = usePlaylistManager();
  const [sections, setSections] = useState<Section[]>([]);
  const [catOffset, setCatOffset] = useState(0);
  const [loadingCats, setLoadingCats] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const loadingRowsRef = useRef<Record<string, boolean>>({});

  const handleLiveLongPress = async (id: string | number) => {
    console.log('📺 Long pressed live/TV with ID:', id);
    const liveData = await getLocalItemData(id, 'live', subscriptionId);
    if (liveData) {
      console.log('📡 Local live data:', liveData);
      try {
        const payload = JSON.parse(liveData.original_payload_json);
        console.log('🎭 Original live payload:', payload);
      } catch {
        console.log('📄 Raw live payload:', liveData.original_payload_json);
      }
    } else {
      console.log('❌ No local live data found for ID:', id);
    }
  };

  const sectionsQuery = useUiSections('live', {
    limitPerCategory: 20,
    maxCategories: 10,
    categoryOffset: 0,
  });

  const previewQuery = useUiPreview('live', 10);

  useEffect(() => {
    if (sectionsQuery.isPending || sectionsQuery.isError) return;
    const cats = sectionsQuery.data || [];
    const mapped: Section[] = cats.map((c) => ({
      categoryId: c.categoryId,
      title: c.name,
      data: c.items
        .map((i) => ({
          id: i.id,
          title: i.title,
          imageUrl: i.imageUrl,
          sourceId: (i as any).sourceId,
        }))
        .sort((a, b) => {
          // Sort favorites first
          const aIsFav = isFavorite(a.id);
          const bIsFav = isFavorite(b.id);
          if (aIsFav && !bIsFav) return -1;
          if (!aIsFav && bIsFav) return 1;
          return 0;
        }),
      aspect: 'backdrop',
    }));
    if (mapped.length === 0 || mapped.every((s) => s.data.length === 0)) {
      if (previewQuery.data) {
        setSections([
          {
            title: 'Recently Added',
            data: previewQuery.data.map((i) => ({
              id: i.id,
              title: i.title,
              imageUrl: i.imageUrl,
            })),
            aspect: 'backdrop',
          },
        ]);
        setInitialLoaded(true);
      }
    } else {
      // Sort categories by favorites count (categories with more favorites first)
      const sortedMapped = mapped.sort((a, b) => {
        const aFavCount = a.data.filter(item => isFavorite(item.id)).length;
        const bFavCount = b.data.filter(item => isFavorite(item.id)).length;
        return bFavCount - aFavCount;
      });
      setSections(sortedMapped);
      setCatOffset(10);
      setInitialLoaded(true);
    }
  }, [
    sectionsQuery.isPending,
    sectionsQuery.isError,
    sectionsQuery.data,
    previewQuery.data,
  ]);

  const loadMoreCategories = useCallback(async () => {
    if (loadingCats || !initialLoaded) return;
    setLoadingCats(true);
    try {
      // CRITICAL: Only fetch data for the current user's account
      if (!subscriptionId) {
        console.warn('[SECURITY] No subscription ID - skipping data fetch');
        return;
      }
      const cats = await fetchCategoriesWithPreviews('live', 20, 5, catOffset, subscriptionId);
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
            aspect: 'backdrop',
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
        // CRITICAL: Only fetch data for the current user's account
        if (!subscriptionId) {
          console.warn('[SECURITY] No subscription ID - skipping data fetch');
          return;
        }
        const more = await fetchCategoryItems(
          'live',
          categoryId,
          25,
          current.data.length,
          subscriptionId
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
            onViewAll={
              item.categoryId
                ? () => router.push(`/category/${item.categoryId}`)
                : undefined
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
                aspect={item.aspect || 'poster'}
                onPress={(id) =>
                  router.push(`/(app)/tv/${encodeURIComponent(String(id))}`)
                }
                onLongPress={handleLiveLongPress}
                isFavorite={isFavorite(row.id)}
                onToggleFavorite={() => toggleFavorite(row.id, 'tv')}
                hasProfile={hasProfile}
                isInPlaylist={isInAnyPlaylist(row.id)}
              />
            )}
          />
        )}
        onEndReachedThreshold={0.6}
        onEndReached={loadMoreCategories}
        ListHeaderComponent={
          <View className="px-6 py-4">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
              TV
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        className="flex-1 bg-white dark:bg-black"
      />
    </SafeAreaView>
  );
}
