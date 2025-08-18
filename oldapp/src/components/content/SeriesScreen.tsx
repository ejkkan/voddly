import React from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { View, Text } from '@/components/ui';
import { isTV } from '@/lib/platform';
import { HorizontalCarousel } from './HorizontalCarousel';

// Mock grouped rows (replace with real categories/data)
const trendingSeries = [
  {
    id: '1',
    title: 'Drama Series S1',
    poster: 'https://via.placeholder.com/200x300',
    subtitle: 'S3 • E30',
    rating: '9.2',
  },
  {
    id: '2',
    title: 'Comedy Show',
    poster: 'https://via.placeholder.com/200x300',
    subtitle: 'S5 • E65',
    rating: '8.5',
  },
  {
    id: '3',
    title: 'Mystery Chronicles',
    poster: 'https://via.placeholder.com/200x300',
    subtitle: 'S2 • E20',
    rating: '8.8',
  },
  {
    id: '4',
    title: 'Sci-Fi Adventures',
    poster: 'https://via.placeholder.com/200x300',
    subtitle: 'S4 • E48',
    rating: '9.0',
  },
  {
    id: '5',
    title: 'Crime Investigation',
    poster: 'https://via.placeholder.com/200x300',
    subtitle: 'S6 • E72',
    rating: '8.7',
  },
  {
    id: '6',
    title: 'Historical Epic',
    poster: 'https://via.placeholder.com/200x300',
    subtitle: 'S3 • E36',
    rating: '9.1',
  },
];

const topSeries = trendingSeries.map((s) => ({ ...s, id: `${s.id}-t` }));
const continueWatching = trendingSeries.map((s) => ({ ...s, id: `${s.id}-c` }));

export default function SeriesScreen() {
  const router = useRouter();
  const onPressSeries = (seriesId: string) =>
    router.push(`/series/${seriesId}`);

  return (
    <View className="flex-1 bg-black">
      <ScrollView
        contentContainerStyle={{ paddingVertical: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pb-2">
          <Text
            className={`${isTV ? 'text-3xl' : 'text-2xl'} font-bold text-white`}
          >
            TV Series
          </Text>
          <Text
            className={`${isTV ? 'text-lg' : 'text-base'} mt-2 text-gray-300`}
          >
            Binge-worthy shows and series
          </Text>
        </View>

        <HorizontalCarousel
          title="Trending Series"
          items={trendingSeries}
          onPressItem={onPressSeries}
        />
        <HorizontalCarousel
          title="Top Series"
          items={topSeries}
          onPressItem={onPressSeries}
        />
        <HorizontalCarousel
          title="Continue Watching"
          items={continueWatching}
          onPressItem={onPressSeries}
        />
      </ScrollView>
    </View>
  );
}
