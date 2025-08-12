import React from 'react';
import { FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { View, Text, Image } from '@/components/ui';
import { isTV, isWeb } from '@/lib/platform';

const { width: screenWidth } = Dimensions.get('window');

// Mock data - replace with actual data
const mockSeries = [
  {
    id: '1',
    title: 'Drama Series S1',
    seasons: 3,
    episodes: 30,
    poster: 'https://via.placeholder.com/200x300',
    rating: '9.2',
  },
  {
    id: '2',
    title: 'Comedy Show',
    seasons: 5,
    episodes: 65,
    poster: 'https://via.placeholder.com/200x300',
    rating: '8.5',
  },
  {
    id: '3',
    title: 'Mystery Chronicles',
    seasons: 2,
    episodes: 20,
    poster: 'https://via.placeholder.com/200x300',
    rating: '8.8',
  },
  {
    id: '4',
    title: 'Sci-Fi Adventures',
    seasons: 4,
    episodes: 48,
    poster: 'https://via.placeholder.com/200x300',
    rating: '9.0',
  },
  {
    id: '5',
    title: 'Crime Investigation',
    seasons: 6,
    episodes: 72,
    poster: 'https://via.placeholder.com/200x300',
    rating: '8.7',
  },
  {
    id: '6',
    title: 'Historical Epic',
    seasons: 3,
    episodes: 36,
    poster: 'https://via.placeholder.com/200x300',
    rating: '9.1',
  },
];

export default function SeriesScreen() {
  const router = useRouter();

  const getNumColumns = () => {
    if (isTV) return 5;
    if (isWeb) return 6;
    if (screenWidth > 768) return 4;
    return 2;
  };

  const handleSeriesPress = (seriesId: string) => {
    // Navigate to series details
    router.push(`/series/${seriesId}`);
  };

  const renderSeriesItem = ({ item }: { item: (typeof mockSeries)[0] }) => {
    const itemSize = isTV ? 'w-48 h-72' : isWeb ? 'w-40 h-60' : 'w-36 h-54';

    return (
      <TouchableOpacity
        onPress={() => handleSeriesPress(item.id)}
        className="m-2"
      >
        <View
          className={`${itemSize} overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800`}
        >
          <Image
            source={{ uri: item.poster }}
            className="h-4/5 w-full"
            resizeMode="cover"
          />
          <View className="flex-1 justify-center p-2">
            <Text
              className={`${
                isTV ? 'text-sm' : 'text-xs'
              } font-medium text-gray-900 dark:text-white`}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <View className="flex-row items-center justify-between">
              <Text
                className={`${
                  isTV ? 'text-xs' : 'text-[10px]'
                } text-gray-600 dark:text-gray-400`}
              >
                S{item.seasons} • E{item.episodes}
              </Text>
              <Text
                className={`${
                  isTV ? 'text-xs' : 'text-[10px]'
                } text-yellow-500`}
              >
                ⭐ {item.rating}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <View className="p-4">
        <Text
          className={`${
            isTV ? 'text-3xl' : 'text-2xl'
          } font-bold text-gray-900 dark:text-white`}
        >
          TV Series
        </Text>
        <Text
          className={`${
            isTV ? 'text-lg' : 'text-base'
          } mt-2 text-gray-600 dark:text-gray-400`}
        >
          Binge-worthy shows and series
        </Text>
      </View>

      <FlatList
        data={mockSeries}
        renderItem={renderSeriesItem}
        keyExtractor={(item) => item.id}
        numColumns={getNumColumns()}
        contentContainerStyle={{ padding: 8 }}
      />
    </View>
  );
}
