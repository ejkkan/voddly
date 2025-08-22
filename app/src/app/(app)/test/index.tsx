/* eslint-disable simple-import-sort/imports */
import React, { useCallback, useEffect, useState } from 'react';
import { SectionList } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchCategoriesWithPreviews } from '@/lib/db/ui';
import { useActiveAccountId } from '@/hooks/ui/useAccounts';
import { PosterCard } from '@/components/media/poster-card';
import { SafeAreaView, View, Text } from '@/components/ui';

type Item = { id: string; title: string; imageUrl?: string | null };
type SectionRow = { key: string; items: Item[] };
type UiSection = { title: string; categoryId: string; data: SectionRow[] };

function chunkIntoRows(items: Item[], rowSize: number): SectionRow[] {
  const rows: SectionRow[] = [];
  let rowIndex = 0;
  for (let i = 0; i < items.length; i += rowSize) {
    const slice = items.slice(i, i + rowSize);
    rows.push({ key: String(rowIndex++), items: slice });
  }
  return rows;
}

export default function VODs() {
  const router = useRouter();
  const { accountId } = useActiveAccountId();
  const [sections, setSections] = useState<UiSection[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cats = await fetchCategoriesWithPreviews(
        'movie',
        12, // items per category
        30, // max categories
        0,
        accountId || undefined
      );
      if (cancelled) return;
      const mapped: UiSection[] = (cats || []).map((c) => {
        const items: Item[] = c.items.map((i) => ({
          id: i.id,
          title: i.title,
          imageUrl: i.imageUrl,
        }));
        return {
          title: c.name,
          categoryId: c.categoryId,
          data: chunkIntoRows(items, 3),
        };
      });
      setSections(mapped);
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const keyExtractor = (row: SectionRow, index: number) => {
    return `${row.key}-${index}`;
  };

  const handlePress = useCallback(
    (id: string | number) => {
      router.push(`/(app)/movies/${encodeURIComponent(String(id))}`);
    },
    [router]
  );

  return (
    <SafeAreaView className="flex-1">
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <CategoryRow items={item.items} onPressItem={handlePress} />
        )}
        renderSectionHeader={({ section }) => (
          <View className="px-6 py-3">
            <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {section.title}
            </Text>
          </View>
        )}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={<VodsHeader />}
        contentContainerStyle={{ paddingBottom: 24 }}
        className="flex-1 bg-white dark:bg-black"
      />
    </SafeAreaView>
  );
}

function CategoryRow({
  items,
  onPressItem,
}: {
  items: Item[];
  onPressItem: (id: string | number) => void;
}) {
  return (
    <View className="mb-3 flex-row px-2 md:px-4">
      {items.map((it) => (
        <View key={String(it.id)} className="mr-3">
          <PosterCard
            id={it.id}
            title={it.title}
            posterUrl={it.imageUrl}
            onPress={onPressItem}
          />
        </View>
      ))}
    </View>
  );
}

function VodsHeader() {
  return (
    <View className="px-6 py-4">
      <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
        VODs
      </Text>
    </View>
  );
}
