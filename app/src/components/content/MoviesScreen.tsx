import React from 'react';
import { FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { View, Text, Image } from '@/components/ui';
import { isTV, isWeb } from '@/lib/platform';

const { width: screenWidth } = Dimensions.get('window');

// Mock data - replace with actual data
const mockMovies = [
  {
    id: '1',
    title: 'Action Movie 1',
    year: 2024,
    poster: 'https://via.placeholder.com/200x300',
    rating: '8.5',
  },
  {
    id: '2',
    title: 'Comedy Special',
    year: 2024,
    poster: 'https://via.placeholder.com/200x300',
    rating: '7.8',
  },
  {
    id: '3',
    title: 'Thriller Night',
    year: 2023,
    poster: 'https://via.placeholder.com/200x300',
    rating: '9.0',
  },
  {
    id: '4',
    title: 'Family Adventure',
    year: 2024,
    poster: 'https://via.placeholder.com/200x300',
    rating: '7.5',
  },
  {
    id: '5',
    title: 'Sci-Fi Epic',
    year: 2024,
    poster: 'https://via.placeholder.com/200x300',
    rating: '8.8',
  },
  {
    id: '6',
    title: 'Drama Series',
    year: 2023,
    poster: 'https://via.placeholder.com/200x300',
    rating: '8.2',
  },
];

export default function MoviesScreen() {
  const router = useRouter();

  // Calculate number of columns based on platform and screen size
  const getNumColumns = () => {
    if (isTV) return 5;
    if (isWeb) return 6;
    if (screenWidth > 768) return 4;
    return 2;
  };

  const handleMoviePress = (movieId: string) => {
    // Navigate to movie details
    router.push(`/movies/${movieId}`);
  };

  const renderMovieItem = ({ item }: { item: (typeof mockMovies)[0] }) => {
    const itemSize = isTV ? 'w-48 h-72' : isWeb ? 'w-40 h-60' : 'w-36 h-54';

    return (
      <TouchableOpacity
        onPress={() => handleMoviePress(item.id)}
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
                {item.year}
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
          Movies
        </Text>
        <Text
          className={`${
            isTV ? 'text-lg' : 'text-base'
          } mt-2 text-gray-600 dark:text-gray-400`}
        >
          Latest and trending movies
        </Text>
      </View>

      <FlatList
        data={mockMovies}
        renderItem={renderMovieItem}
        keyExtractor={(item) => item.id}
        numColumns={getNumColumns()}
        contentContainerStyle={{ padding: 8 }}
      />
    </View>
  );
}
