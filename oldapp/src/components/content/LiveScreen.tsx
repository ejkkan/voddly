import React from 'react';
import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { View, Text } from '@/components/ui';
import { isTV } from '@/lib/platform';
import { HorizontalCarousel } from './HorizontalCarousel';

// Mock rows for live categories (replace with real data)
const sports = [
  {
    id: '1',
    title: 'Sports HD',
    poster: 'https://via.placeholder.com/200x300',
    subtitle: 'Live: Football',
    rating: '',
  },
  {
    id: '2',
    title: 'News 24',
    poster: 'https://via.placeholder.com/200x300',
    subtitle: 'Live: Headlines',
    rating: '',
  },
  {
    id: '3',
    title: 'Movie Plus',
    poster: 'https://via.placeholder.com/200x300',
    subtitle: 'Live: Action',
    rating: '',
  },
  {
    id: '4',
    title: 'Kids TV',
    poster: 'https://via.placeholder.com/200x300',
    subtitle: 'Live: Cartoons',
    rating: '',
  },
];
const news = sports.map((c, i) => ({ ...c, id: `${c.id}-n` }));
const entertainment = sports.map((c, i) => ({ ...c, id: `${c.id}-e` }));

export default function LiveScreen() {
  const router = useRouter();
  const onPressChannel = (channelId: string) =>
    router.push(`/live/${channelId}`);

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
            Live
          </Text>
          <Text
            className={`${isTV ? 'text-lg' : 'text-base'} mt-2 text-gray-300`}
          >
            Browse live channels
          </Text>
        </View>

        <HorizontalCarousel
          title="Sports"
          items={sports}
          onPressItem={onPressChannel}
        />
        <HorizontalCarousel
          title="News"
          items={news}
          onPressItem={onPressChannel}
        />
        <HorizontalCarousel
          title="Entertainment"
          items={entertainment}
          onPressItem={onPressChannel}
        />
      </ScrollView>
    </View>
  );
}
