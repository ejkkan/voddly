import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';

import { PosterCard } from '@/components/media/poster-card';
import { SafeAreaView, ScrollView, Text, View } from '@/components/ui';
import { useFavoriteManager } from '@/hooks/ui';
import { getLocalItemData } from '@/hooks/ui/useDashboardTrends';
import { usePlaylistManager } from '@/hooks/ui/usePlaylistManager';
import { fetchCategoryInfo, fetchCategoryItems } from '@/lib/db/ui';

type MediaItem = {
  id: string;
  title: string;
  imageUrl?: string | null;
  sourceId?: string;
};

type CategoryInfo = {
  id: string;
  name: string;
  type: 'movie' | 'series';
};

export default function CategoryPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const categoryId = params.id as string;
  const { isFavorite, toggleFavorite, hasProfile } = useFavoriteManager();
  const { isInAnyPlaylist } = usePlaylistManager();

  const [categoryInfo, setCategoryInfo] = useState<CategoryInfo | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const handleItemLongPress = async (id: string | number) => {
    if (!categoryInfo) return;

    const typeLabel =
      categoryInfo.type === 'movie'
        ? '🎬'
        : categoryInfo.type === 'series'
          ? '📺'
          : '📡';
    console.log(`${typeLabel} Long pressed ${categoryInfo.type} with ID:`, id);
    const itemData = await getLocalItemData(id, categoryInfo.type);

    if (itemData) {
      console.log(
        `${typeLabel} Local ${categoryInfo.type} data:`,
        JSON.stringify(itemData, null, 2)
      );
      try {
        const payload = JSON.parse(itemData.original_payload_json);
        console.log(
          `🎭 Original ${categoryInfo.type} payload:`,
          JSON.stringify(payload, null, 2)
        );
      } catch {
        console.log(
          `📄 Raw ${categoryInfo.type} payload:`,
          itemData.original_payload_json
        );
      }
    } else {
      console.log(`❌ No local ${categoryInfo.type} data found for ID:`, id);
    }
  };

  // Load initial category info and first batch of items
  useEffect(() => {
    const loadInitialData = async () => {
      if (!categoryId) return;

      setLoading(true);
      try {
        // Fetch category info
        const info = await fetchCategoryInfo(categoryId);
        if (info) {
          setCategoryInfo({
            id: info.id,
            name: info.name,
            type: info.type as 'movie' | 'series',
          });

          // Fetch first 20 items
          const initialItems = await fetchCategoryItems(
            info.type as 'movie' | 'series',
            categoryId,
            20,
            0
          );

          if (initialItems) {
            setItems(
              initialItems.map((item) => ({
                id: item.id,
                title: item.title,
                imageUrl: item.imageUrl,
                sourceId: (item as any).sourceId,
              }))
            );
            setHasMore(initialItems.length === 20);
          }
        }
      } catch (error) {
        console.error('Error loading category data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [categoryId]);

  // Load more items when scrolling
  const loadMoreItems = useCallback(async () => {
    if (!categoryInfo || !hasMore || loadingMore) return;

    setLoadingMore(true);
    try {
      const moreItems = await fetchCategoryItems(
        categoryInfo.type,
        categoryId,
        20,
        items.length
      );

      if (moreItems && moreItems.length > 0) {
        setItems((prev) => [
          ...prev,
          ...moreItems.map((item) => ({
            id: item.id,
            title: item.title,
            imageUrl: item.imageUrl,
            sourceId: (item as any).sourceId,
          })),
        ]);
        setHasMore(moreItems.length === 20);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more items:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [categoryInfo, categoryId, items.length, hasMore, loadingMore]);

  const handleItemPress = useCallback(
    (id: string | number) => {
      if (!categoryInfo) return;

      const route =
        categoryInfo.type === 'movie'
          ? `/(app)/movies/${encodeURIComponent(String(id))}`
          : `/(app)/series/${encodeURIComponent(String(id))}`;

      router.push(route as any);
    },
    [categoryInfo, router]
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-black">
        <View className="flex-1 items-center justify-center">
          <Text className="text-neutral-500">Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <View className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
          {categoryInfo?.name || 'Category'}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const paddingToBottom = 20;
          if (
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - paddingToBottom
          ) {
            loadMoreItems();
          }
        }}
        scrollEventThrottle={400}
      >
        <View className="flex flex-row flex-wrap px-2 pb-6">
          {items.map((item) => (
            <View
              key={item.id}
              className="w-1/2 p-2 sm:w-1/3 md:w-1/4 lg:w-1/5 xl:w-1/6"
            >
              <PosterCard
                id={item.id}
                title={item.title}
                posterUrl={item.imageUrl}
                onPress={handleItemPress}
                onLongPress={handleItemLongPress}
                isFavorite={isFavorite(item.id)}
                onToggleFavorite={() =>
                  toggleFavorite(item.id, categoryInfo?.type || 'movie')
                }
                hasProfile={hasProfile}
                isInPlaylist={isInAnyPlaylist(item.id)}
              />
            </View>
          ))}
        </View>

        {items.length === 0 && !loading && (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-neutral-500">No items found</Text>
          </View>
        )}

        {loadingMore && (
          <View className="py-4">
            <Text className="text-center text-neutral-500">
              Loading more...
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
