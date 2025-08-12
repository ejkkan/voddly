import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, TouchableOpacity } from 'react-native';
import { View, Text, Image, Button, SafeAreaView } from '@/components/ui';
import { isTV, isWeb } from '@/lib/platform';

// Mock movie data - replace with actual API call
const getMovieDetails = (id: string) => ({
  id,
  title: `Movie ${id}`,
  year: 2024,
  duration: '2h 15m',
  rating: '8.5',
  genre: 'Action, Adventure',
  description:
    'An epic adventure that takes you on a journey through stunning visuals and compelling storytelling. Watch as our heroes face impossible odds and discover the true meaning of courage.',
  poster: 'https://via.placeholder.com/400x600',
  backdrop: 'https://via.placeholder.com/1920x1080',
  director: 'John Director',
  cast: ['Actor One', 'Actor Two', 'Actor Three'],
});

export default function MovieDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const movie = getMovieDetails(id || '1');

  const handlePlay = () => {
    router.push({
      pathname: '/player',
      params: {
        type: 'movie',
        id: movie.id,
        title: movie.title,
      },
    });
  };

  const handleBack = () => {
    router.back();
  };

  const containerPadding = isTV ? 'p-12' : isWeb ? 'p-8' : 'p-4';
  const titleSize = isTV ? 'text-5xl' : isWeb ? 'text-4xl' : 'text-3xl';
  const textSize = isTV ? 'text-xl' : isWeb ? 'text-lg' : 'text-base';
  const buttonSize = isTV ? 'text-2xl py-4 px-8' : 'text-lg py-3 px-6';

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView>
        {/* Backdrop Image */}
        <View className="relative h-96">
          <Image
            source={{ uri: movie.backdrop }}
            className="h-full w-full"
            resizeMode="cover"
          />
          <View className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

          {/* Back Button */}
          <TouchableOpacity
            onPress={handleBack}
            className="absolute left-4 top-4 rounded-full bg-black/50 p-3"
          >
            <Text className="text-white">← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Movie Info */}
        <View className={containerPadding}>
          <View className="flex-row">
            {/* Poster */}
            <Image
              source={{ uri: movie.poster }}
              className="mr-6 h-64 w-44 rounded-lg"
              resizeMode="cover"
            />

            {/* Details */}
            <View className="flex-1">
              <Text className={`${titleSize} font-bold text-white`}>
                {movie.title}
              </Text>

              <View className="mt-2 flex-row items-center space-x-4">
                <Text className="text-yellow-500">⭐ {movie.rating}</Text>
                <Text className="text-gray-400">•</Text>
                <Text className="text-gray-400">{movie.year}</Text>
                <Text className="text-gray-400">•</Text>
                <Text className="text-gray-400">{movie.duration}</Text>
              </View>

              <Text className="mt-2 text-gray-400">{movie.genre}</Text>

              {/* Action Buttons */}
              <View className="mt-6 flex-row space-x-4">
                <TouchableOpacity
                  onPress={handlePlay}
                  className={`rounded-lg bg-blue-600 ${buttonSize}`}
                >
                  <Text className="font-semibold text-white">▶ Play</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`rounded-lg border border-gray-600 ${buttonSize}`}
                >
                  <Text className="text-white">+ My List</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Description */}
          <View className="mt-8">
            <Text
              className={`${titleSize === 'text-5xl' ? 'text-2xl' : 'text-xl'} mb-3 font-semibold text-white`}
            >
              Synopsis
            </Text>
            <Text className={`${textSize} leading-relaxed text-gray-300`}>
              {movie.description}
            </Text>
          </View>

          {/* Cast & Crew */}
          <View className="mt-8">
            <Text
              className={`${titleSize === 'text-5xl' ? 'text-2xl' : 'text-xl'} mb-3 font-semibold text-white`}
            >
              Cast & Crew
            </Text>
            <Text className={`${textSize} text-gray-300`}>
              Director: {movie.director}
            </Text>
            <Text className={`${textSize} mt-2 text-gray-300`}>
              Starring: {movie.cast.join(', ')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
