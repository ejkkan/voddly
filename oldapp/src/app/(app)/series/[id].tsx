import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { View, Text, Image, SafeAreaView } from '@/components/ui';
import { isTV, isWeb } from '@/lib/platform';

// Mock series data - replace with actual API call
const getSeriesDetails = (id: string) => ({
  id,
  title: `Series ${id}`,
  year: '2022-2024',
  seasons: 3,
  totalEpisodes: 30,
  rating: '9.1',
  genre: 'Drama, Mystery',
  description:
    'A gripping series that explores the depths of human nature through complex characters and intricate storylines. Each season unveils new mysteries while developing deep character arcs.',
  poster: 'https://via.placeholder.com/400x600',
  backdrop: 'https://via.placeholder.com/1920x1080',
  creator: 'Jane Creator',
  cast: ['Actor One', 'Actor Two', 'Actor Three'],
  seasons_data: [
    {
      season: 1,
      episodes: [
        { id: 'e1', number: 1, title: 'Pilot', duration: '45m' },
        { id: 'e2', number: 2, title: 'The Beginning', duration: '42m' },
        { id: 'e3', number: 3, title: 'Revelations', duration: '44m' },
        { id: 'e4', number: 4, title: 'Crossroads', duration: '43m' },
        { id: 'e5', number: 5, title: 'The Truth', duration: '45m' },
      ],
    },
    {
      season: 2,
      episodes: [
        { id: 'e6', number: 1, title: 'Return', duration: '44m' },
        { id: 'e7', number: 2, title: 'New Threats', duration: '43m' },
        { id: 'e8', number: 3, title: 'Alliance', duration: '45m' },
        { id: 'e9', number: 4, title: 'Betrayal', duration: '42m' },
        { id: 'e10', number: 5, title: 'Resolution', duration: '46m' },
      ],
    },
    {
      season: 3,
      episodes: [
        { id: 'e11', number: 1, title: 'New Dawn', duration: '45m' },
        { id: 'e12', number: 2, title: 'Complications', duration: '44m' },
        { id: 'e13', number: 3, title: 'The Hunt', duration: '43m' },
        { id: 'e14', number: 4, title: 'Finale Part 1', duration: '45m' },
        { id: 'e15', number: 5, title: 'Finale Part 2', duration: '48m' },
      ],
    },
  ],
});

export default function SeriesDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const series = getSeriesDetails(id || '1');
  const [selectedSeason, setSelectedSeason] = useState(1);

  console.log('📺 SeriesDetails rendered with id:', id);

  const handlePlayEpisode = (episodeId: string, episodeTitle: string) => {
    router.push({
      pathname: '/player',
      params: {
        type: 'series',
        id: series.id,
        episodeId,
        title: `${series.title} - ${episodeTitle}`,
      },
    });
  };

  const handleBack = () => {
    router.back();
  };

  const containerPadding = isTV ? 'p-12' : isWeb ? 'p-8' : 'p-4';
  const titleSize = isTV ? 'text-5xl' : isWeb ? 'text-4xl' : 'text-3xl';
  const textSize = isTV ? 'text-xl' : isWeb ? 'text-lg' : 'text-base';

  const currentSeasonData = series.seasons_data.find(
    (s) => s.season === selectedSeason
  );

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView>
        {/* Backdrop Image */}
        <View className="relative h-96">
          <Image
            source={{ uri: series.backdrop }}
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

        {/* Series Info */}
        <View className={containerPadding}>
          <View className="flex-row">
            {/* Poster */}
            <Image
              source={{ uri: series.poster }}
              className="mr-6 h-64 w-44 rounded-lg"
              resizeMode="cover"
            />

            {/* Details */}
            <View className="flex-1">
              <Text className={`${titleSize} font-bold text-white`}>
                {series.title}
              </Text>

              <View className="mt-2 flex-row items-center space-x-4">
                <Text className="text-yellow-500">⭐ {series.rating}</Text>
                <Text className="text-gray-400">•</Text>
                <Text className="text-gray-400">{series.year}</Text>
                <Text className="text-gray-400">•</Text>
                <Text className="text-gray-400">{series.seasons} Seasons</Text>
              </View>

              <Text className="mt-2 text-gray-400">{series.genre}</Text>

              {/* Season Selector */}
              <View className="mt-6">
                <Text className="mb-2 text-gray-400">Select Season:</Text>
                <View className="flex-row space-x-2">
                  {series.seasons_data.map((season) => (
                    <TouchableOpacity
                      key={season.season}
                      onPress={() => setSelectedSeason(season.season)}
                      className={`rounded-lg px-4 py-2 ${
                        selectedSeason === season.season
                          ? 'bg-blue-600'
                          : 'bg-gray-800'
                      }`}
                    >
                      <Text className="text-white">Season {season.season}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
              {series.description}
            </Text>
          </View>

          {/* Episodes */}
          <View className="mt-8">
            <Text
              className={`${titleSize === 'text-5xl' ? 'text-2xl' : 'text-xl'} mb-4 font-semibold text-white`}
            >
              Season {selectedSeason} Episodes
            </Text>

            {currentSeasonData?.episodes.map((episode) => (
              <TouchableOpacity
                key={episode.id}
                onPress={() => handlePlayEpisode(episode.id, episode.title)}
                className="mb-3 flex-row items-center rounded-lg bg-gray-900 p-4"
              >
                <View className="mr-4 h-16 w-16 items-center justify-center rounded bg-gray-800">
                  <Text className="text-xl font-bold text-white">
                    {episode.number}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className={`${textSize} font-medium text-white`}>
                    {episode.title}
                  </Text>
                  <Text className="text-sm text-gray-400">
                    Episode {episode.number} • {episode.duration}
                  </Text>
                </View>
                <Text className="text-2xl text-gray-400">▶</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cast & Crew */}
          <View className="mt-8">
            <Text
              className={`${titleSize === 'text-5xl' ? 'text-2xl' : 'text-xl'} mb-3 font-semibold text-white`}
            >
              Cast & Crew
            </Text>
            <Text className={`${textSize} text-gray-300`}>
              Creator: {series.creator}
            </Text>
            <Text className={`${textSize} mt-2 text-gray-300`}>
              Starring: {series.cast.join(', ')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
