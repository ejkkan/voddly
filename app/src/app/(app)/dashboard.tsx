/* eslint-disable max-lines-per-function */
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { SafeAreaView, ScrollView, View } from '@/components/ui';
import { useDashboardPreviews } from '@/hooks/ui';

import { CarouselRow } from '../../components/media/carousel-row';
import Hero from '../../components/media/hero';
import { PosterCard } from '../../components/media/poster-card';

export default function Dashboard() {
  const router = useRouter();
  const [movies, setMovies] = useState<
    { id: string; title: string; imageUrl?: string | null; sourceId?: string }[]
  >([]);
  const [series, setSeries] = useState<
    { id: string; title: string; imageUrl?: string | null; sourceId?: string }[]
  >([]);
  const [live, setLive] = useState<
    { id: string; title: string; imageUrl?: string | null; sourceId?: string }[]
  >([]);

  const dashboard = useDashboardPreviews(10);
  useEffect(() => {
    const res = dashboard.data;
    if (!res) return;
    setMovies(
      res.movies.map((i) => ({
        id: i.id,
        title: i.title,
        imageUrl: i.imageUrl,
        sourceId: (i as any).sourceId,
      }))
    );
    setSeries(
      res.series.map((i) => ({
        id: i.id,
        title: i.title,
        imageUrl: i.imageUrl,
        sourceId: (i as any).sourceId,
      }))
    );
    setLive(
      res.live.map((i) => ({
        id: i.id,
        title: i.title,
        imageUrl: i.imageUrl,
        sourceId: (i as any).sourceId,
      }))
    );
  }, [dashboard.data]);

  return (
    <SafeAreaView className="flex-1">
      <ScrollView
        className="flex-1 bg-white dark:bg-black"
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        <View className="px-3 md:px-6 lg:px-10">
          <Hero
            title="Dune: Part Two"
            subtitle="Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family."
            imageUrl="https://image.tmdb.org/t/p/original/8bcoRX3hQRHufLPSDREdvr3YMXx.jpg"
            primaryAction={{ label: 'Play', onPress: () => {} }}
            secondaryAction={{ label: 'More Info', onPress: () => {} }}
          />
        </View>

        <View className="mt-2">
          <CarouselRow
            title="Movies"
            data={movies}
            renderItem={(item) => (
              <PosterCard
                id={item.id}
                title={item.title}
                posterUrl={item.imageUrl}
                sourceId={(item as any).sourceId}
                onPress={(id) =>
                  router.push(`/(app)/movies/${encodeURIComponent(String(id))}`)
                }
              />
            )}
          />
          <CarouselRow
            title="Series"
            data={series}
            renderItem={(item) => (
              <PosterCard
                id={item.id}
                title={item.title}
                posterUrl={item.imageUrl}
                sourceId={(item as any).sourceId}
                onPress={(id) =>
                  router.push(`/(app)/series/${encodeURIComponent(String(id))}`)
                }
              />
            )}
          />
          <CarouselRow
            title="Live"
            data={live}
            renderItem={(item) => (
              <PosterCard
                id={item.id}
                title={item.title}
                posterUrl={item.imageUrl}
                sourceId={(item as any).sourceId}
                onPress={(id) =>
                  router.push(`/(app)/live/${encodeURIComponent(String(id))}`)
                }
              />
            )}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
