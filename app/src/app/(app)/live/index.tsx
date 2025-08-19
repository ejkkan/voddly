import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, View, Text } from '@/components/ui';
import { CarouselRow } from '@/components/media/carousel-row';
import { PosterCard } from '@/components/media/poster-card';
import {
  fetchCategoriesWithPreviews,
  backfillMissingItemCategories,
  fetchPreviewByType,
} from '@/lib/db/ui';

type Section = {
  title: string;
  data: Array<{ id: string; title: string; imageUrl?: string | null }>;
  aspect?: 'poster' | 'backdrop';
};

export default function Live() {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        await backfillMissingItemCategories();
      } catch {}
      return fetchCategoriesWithPreviews('live', 20, 6);
    };
    run()
      .then((cats) => {
        if (!mounted) return;
        const mapped: Section[] = cats.map((c) => ({
          title: c.name,
          data: c.items.map((i) => ({
            id: i.id,
            title: i.title,
            imageUrl: i.imageUrl,
          })),
          aspect: 'backdrop',
        }));
        if (mapped.length === 0 || mapped.every((s) => s.data.length === 0)) {
          fetchPreviewByType('live', 20)
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
                  aspect: 'backdrop',
                },
              ]);
            })
            .catch(() => setSections([]));
        } else {
          setSections(mapped);
        }
      })
      .catch(() => setSections([]));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView>
      <ScrollView
        className="flex-1 bg-white dark:bg-black"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="px-6 py-4">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            Live
          </Text>
        </View>

        {sections.map((section) => (
          <CarouselRow
            key={section.title}
            title={section.title}
            data={section.data}
            renderItem={(item) => (
              <PosterCard
                id={item.id}
                title={item.title}
                posterUrl={item.imageUrl}
                aspect={section.aspect || 'poster'}
                onPress={(id) =>
                  router.push(`/(app)/live/${encodeURIComponent(String(id))}`)
                }
              />
            )}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
