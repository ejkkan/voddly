import React, { useMemo } from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { View, Text } from '@/components/ui';
import { isTV } from '@/lib/platform';
import { HorizontalCarousel } from './HorizontalCarousel';

// Mock grouped rows (replace with real categories/data)
const popularNow = [
  {
    id: '1',
    title: 'Action Movie 1',
    poster: 'https://via.placeholder.com/200x300',
    subtitle: '2024',
    rating: '8.5',
  },
  {
    id: '2',
    title: 'Comedy Special',
    poster: 'https://via.placeholder.com/200x300',
    subtitle: '2024',
    rating: '7.8',
  },
  {
    id: '3',
    title: 'Thriller Night',
    poster: 'https://via.placeholder.com/200x300',
    subtitle: '2023',
    rating: '9.0',
  },
  {
    id: '4',
    title: 'Family Adventure',
    poster: 'https://via.placeholder.com/200x300',
    subtitle: '2024',
    rating: '7.5',
  },
  {
    id: '5',
    title: 'Sci-Fi Epic',
    poster: 'https://via.placeholder.com/200x300',
    subtitle: '2024',
    rating: '8.8',
  },
  {
    id: '6',
    title: 'Drama Story',
    poster: 'https://via.placeholder.com/200x300',
    subtitle: '2023',
    rating: '8.2',
  },
];

const topPicks = popularNow.map((m, i) => ({ ...m, id: `${m.id}-t` }));
const trending = popularNow.map((m, i) => ({ ...m, id: `${m.id}-r` }));

export default function MoviesScreen() {
  const router = useRouter();

  const onPressMovie = (movieId: string) => {
    console.log('onPressMovie', movieId);
    router.push(`/movies/${movieId}`);
  };

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
            Movies
          </Text>
          <Text
            className={`${isTV ? 'text-lg' : 'text-base'} mt-2 text-gray-300`}
          >
            Latest and trending movies
          </Text>
        </View>

        <HorizontalCarousel
          title="Popular Now"
          items={popularNow}
          onPressItem={onPressMovie}
        />
        <HorizontalCarousel
          title="Top Picks for You"
          items={topPicks}
          onPressItem={onPressMovie}
        />
        <HorizontalCarousel
          title="Trending"
          items={trending}
          onPressItem={onPressMovie}
        />
      </ScrollView>
    </View>
  );
}
