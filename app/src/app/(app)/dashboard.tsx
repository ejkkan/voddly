/* eslint-disable max-lines-per-function */
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { SafeAreaView, ScrollView, View } from '@/components/ui';
import { useFavoriteManager } from '@/hooks/ui';
import {
  type DashboardItem,
  type DashboardPreviewsResult,
  useDashboardPreviews,
} from '@/hooks/ui/useDashboard';
import {
  DASHBOARD_TREND_FEEDS,
  getLocalItemData,
  useDashboardTrends,
} from '@/hooks/ui/useDashboardTrends';
import { useIsDashboardRoute } from '@/hooks/ui/useRouteActive';

import { CarouselRow } from '../../components/media/carousel-row';
import Hero from '../../components/media/hero';
import { PosterCard } from '../../components/media/poster-card';

export default function Dashboard() {
  const router = useRouter();
  const { isFavorite, toggleFavorite, hasProfile } = useFavoriteManager();
  const [movies, setMovies] = useState<
    { id: string; title: string; imageUrl?: string | null; sourceId?: string }[]
  >([]);
  const [series, setSeries] = useState<
    { id: string; title: string; imageUrl?: string | null; sourceId?: string }[]
  >([]);
  const [live, setLive] = useState<
    { id: string; title: string; imageUrl?: string | null; sourceId?: string }[]
  >([]);

  // Long press handlers for each content type
  const handleMovieLongPress = async (id: string | number) => {
    console.log('🎬 Long pressed movie with ID:', id);
    const movieData = await getLocalItemData(id, 'movie');

    if (movieData) {
      console.log('📽️ Local movie data:', JSON.stringify(movieData, null, 2));
      // Parse original payload if it's JSON
      try {
        const payload = JSON.parse(movieData.original_payload_json);
        console.log(
          '🎭 Original movie payload:',
          JSON.stringify(payload, null, 2)
        );
      } catch {
        console.log('📄 Raw movie payload:', movieData.original_payload_json);
      }
    } else {
      console.log('❌ No local movie data found for ID:', id);
    }
  };

  const handleSeriesLongPress = async (id: string | number) => {
    console.log('📺 Long pressed series with ID:', id);
    const seriesData = await getLocalItemData(id, 'series');
    if (seriesData) {
      console.log('📺 Local series data:', seriesData);
      // Parse original payload if it's JSON
      try {
        const payload = JSON.parse(seriesData.original_payload_json);
        console.log('🎭 Original series payload:', payload);
      } catch {
        console.log('📄 Raw series payload:', seriesData.original_payload_json);
      }
    } else {
      console.log('❌ No local series data found for ID:', id);
    }
  };

  const handleLiveLongPress = async (id: string | number) => {
    console.log('📻 Long pressed live content with ID:', id);
    const liveData = await getLocalItemData(id, 'live');
    if (liveData) {
      console.log('📻 Local live data:', liveData);
      // Parse original payload if it's JSON
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

  // Track route focus to conditionally enable trends and content

  const isDashboard = useIsDashboardRoute();
  const dashboard = useDashboardPreviews(10);
  const trends = useDashboardTrends(isDashboard);

  useEffect(() => {
    const res = dashboard.data as DashboardPreviewsResult | undefined;
    if (!res) return;
    if (res.movies) {
      setMovies(
        res.movies.map((i: DashboardItem) => ({
          id: i.id,
          title: i.title,
          imageUrl: i.imageUrl,
          sourceId: i.sourceId,
        }))
      );
    }
    if (res.series) {
      setSeries(
        res.series.map((i: DashboardItem) => ({
          id: i.id,
          title: i.title,
          imageUrl: i.imageUrl,
          sourceId: i.sourceId,
        }))
      );
    }
    if (res.live) {
      setLive(
        res.live.map((i: DashboardItem) => ({
          id: i.id, // Live content doesn't typically have TMDB IDs
          title: i.title,
          imageUrl: i.imageUrl,
          sourceId: i.sourceId,
        }))
      );
    }
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
          {DASHBOARD_TREND_FEEDS.map((feed) => {
            const feedTitleMap: Record<string, string> = {
              trending: 'Trending',
              popular: 'Popular',
              watched_weekly: 'Most Watched (Week)',
              anticipated: 'Most Anticipated',
            };
            const movieFeed = trends.movies?.[feed];
            const seriesFeed = trends.series?.[feed];
            return (
              <React.Fragment key={`feed-${feed}`}>
                {movieFeed && (
                  <CarouselRow
                    title={`${feedTitleMap[feed]} Movies`}
                    data={(movieFeed.items || [])
                      .filter((t) => !!t.local_id)
                      .map((t) => ({
                        id: String(t.local_id),
                        title: t.title,
                        imageUrl: t.poster_path || null,
                      }))}
                    renderItem={(item) => (
                      <PosterCard
                        id={item.id}
                        title={item.title}
                        posterUrl={item.imageUrl}
                        onPress={(id) =>
                          router.push(
                            `/(app)/movies/${encodeURIComponent(String(id))}`
                          )
                        }
                        onLongPress={handleMovieLongPress}
                        isFavorite={isFavorite(item.id)}
                        onToggleFavorite={() =>
                          toggleFavorite(item.id, 'movie')
                        }
                        hasProfile={hasProfile}
                      />
                    )}
                  />
                )}
                {seriesFeed && (
                  <CarouselRow
                    title={`${feedTitleMap[feed]} Series`}
                    data={(seriesFeed.items || [])
                      .filter((t) => !!t.local_id)
                      .map((t) => ({
                        id: String(t.local_id),
                        title: t.title,
                        imageUrl: t.poster_path || null,
                      }))}
                    renderItem={(item) => (
                      <PosterCard
                        id={item.id}
                        title={item.title}
                        posterUrl={item.imageUrl}
                        onPress={(id) =>
                          router.push(
                            `/(app)/series/${encodeURIComponent(String(id))}`
                          )
                        }
                        onLongPress={handleSeriesLongPress}
                        isFavorite={isFavorite(item.id)}
                        onToggleFavorite={() =>
                          toggleFavorite(item.id, 'series')
                        }
                        hasProfile={hasProfile}
                      />
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* Only render content sections when on dashboard route */}
          {isDashboard && (
            <>
              <CarouselRow
                title="Movies"
                data={movies}
                renderItem={(item) => (
                  <PosterCard
                    id={item.id}
                    title={item.title}
                    posterUrl={item.imageUrl}
                    onPress={(id) =>
                      router.push(
                        `/(app)/movies/${encodeURIComponent(String(id))}`
                      )
                    }
                    onLongPress={handleMovieLongPress}
                    isFavorite={isFavorite(item.id)}
                    onToggleFavorite={() => toggleFavorite(item.id, 'movie')}
                    hasProfile={hasProfile}
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
                    onPress={(id) =>
                      router.push(
                        `/(app)/series/${encodeURIComponent(String(id))}`
                      )
                    }
                    onLongPress={handleSeriesLongPress}
                    isFavorite={isFavorite(item.id)}
                    onToggleFavorite={() => toggleFavorite(item.id, 'series')}
                    hasProfile={hasProfile}
                  />
                )}
              />
              <CarouselRow
                title="TV"
                data={live}
                renderItem={(item) => (
                  <PosterCard
                    id={item.id}
                    title={item.title}
                    posterUrl={item.imageUrl}
                    onPress={(id) =>
                      router.push(
                        `/(app)/live/${encodeURIComponent(String(id))}`
                      )
                    }
                    onLongPress={handleLiveLongPress}
                    isFavorite={isFavorite(item.id)}
                    onToggleFavorite={() => toggleFavorite(item.id, 'tv')}
                    hasProfile={hasProfile}
                  />
                )}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
