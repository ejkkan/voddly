import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, TouchableOpacity } from 'react-native';
import { View, Text, Image, SafeAreaView } from '@/components/ui';
import { isTV, isWeb } from '@/lib/platform';

// Mock live channel data - replace with actual API call
const getChannelDetails = (id: string) => ({
  id,
  name: `Channel ${id}`,
  category: 'Entertainment',
  icon: '📺',
  isLive: true,
  currentProgram: {
    title: 'Live Show Special',
    startTime: '8:00 PM',
    endTime: '10:00 PM',
    progress: 65,
    description:
      'Join us for an exciting live broadcast featuring exclusive content and special guests.',
  },
  upcomingPrograms: [
    { time: '10:00 PM', title: 'Late Night Talk Show', duration: '1h' },
    { time: '11:00 PM', title: 'Comedy Hour', duration: '1h' },
    { time: '12:00 AM', title: 'Midnight Movies', duration: '2h' },
    { time: '2:00 AM', title: 'Night Replays', duration: '2h' },
  ],
  channelInfo: {
    quality: 'HD 1080p',
    language: 'English',
    subtitles: 'Available',
    audioTracks: 2,
  },
});

export default function LiveChannelDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const channel = getChannelDetails(id || '1');

  const handleWatchLive = () => {
    router.push({
      pathname: '/player',
      params: {
        type: 'live',
        id: channel.id,
        title: channel.name,
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
        {/* Header */}
        <View className="bg-gray-900 p-6">
          <TouchableOpacity
            onPress={handleBack}
            className="mb-4 self-start rounded-full bg-black/50 p-3"
          >
            <Text className="text-white">← Back</Text>
          </TouchableOpacity>

          <View className="flex-row items-center">
            <View className="mr-6 h-24 w-24 items-center justify-center rounded-lg bg-gray-800">
              <Text className="text-5xl">{channel.icon}</Text>
            </View>

            <View className="flex-1">
              <Text className={`${titleSize} font-bold text-white`}>
                {channel.name}
              </Text>
              <View className="mt-2 flex-row items-center">
                <View className="mr-2 h-3 w-3 animate-pulse rounded-full bg-red-500" />
                <Text className="text-red-500">LIVE</Text>
                <Text className="ml-4 text-gray-400">{channel.category}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Current Program */}
        <View className={containerPadding}>
          <View className="rounded-lg bg-gray-900 p-6">
            <View className="mb-4 flex-row items-center justify-between">
              <Text
                className={`${titleSize === 'text-5xl' ? 'text-2xl' : 'text-xl'} font-semibold text-white`}
              >
                Now Playing
              </Text>
              <TouchableOpacity
                onPress={handleWatchLive}
                className={`rounded-lg bg-red-600 ${buttonSize}`}
              >
                <Text className="font-semibold text-white">🔴 Watch Live</Text>
              </TouchableOpacity>
            </View>

            <Text className={`${textSize} mb-2 font-medium text-white`}>
              {channel.currentProgram.title}
            </Text>

            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-sm text-gray-400">
                {channel.currentProgram.startTime} -{' '}
                {channel.currentProgram.endTime}
              </Text>
              <Text className="text-sm text-gray-400">
                {channel.currentProgram.progress}% complete
              </Text>
            </View>

            {/* Progress Bar */}
            <View className="mb-4 h-2 rounded-full bg-gray-700">
              <View
                className="h-full rounded-full bg-red-600"
                style={{ width: `${channel.currentProgram.progress}%` }}
              />
            </View>

            <Text className={`text-sm leading-relaxed text-gray-300`}>
              {channel.currentProgram.description}
            </Text>
          </View>

          {/* Channel Info */}
          <View className="mt-6">
            <Text
              className={`${titleSize === 'text-5xl' ? 'text-2xl' : 'text-xl'} mb-4 font-semibold text-white`}
            >
              Channel Information
            </Text>

            <View className="grid grid-cols-2 gap-4">
              <View className="rounded-lg bg-gray-900 p-4">
                <Text className="text-sm text-gray-400">Quality</Text>
                <Text className={`${textSize} text-white`}>
                  {channel.channelInfo.quality}
                </Text>
              </View>

              <View className="rounded-lg bg-gray-900 p-4">
                <Text className="text-sm text-gray-400">Language</Text>
                <Text className={`${textSize} text-white`}>
                  {channel.channelInfo.language}
                </Text>
              </View>

              <View className="rounded-lg bg-gray-900 p-4">
                <Text className="text-sm text-gray-400">Subtitles</Text>
                <Text className={`${textSize} text-white`}>
                  {channel.channelInfo.subtitles}
                </Text>
              </View>

              <View className="rounded-lg bg-gray-900 p-4">
                <Text className="text-sm text-gray-400">Audio Tracks</Text>
                <Text className={`${textSize} text-white`}>
                  {channel.channelInfo.audioTracks} available
                </Text>
              </View>
            </View>
          </View>

          {/* Upcoming Programs */}
          <View className="mt-8">
            <Text
              className={`${titleSize === 'text-5xl' ? 'text-2xl' : 'text-xl'} mb-4 font-semibold text-white`}
            >
              Coming Up Next
            </Text>

            {channel.upcomingPrograms.map((program, index) => (
              <View
                key={index}
                className="mb-3 flex-row items-center rounded-lg bg-gray-900 p-4"
              >
                <View className="mr-4">
                  <Text className={`${textSize} font-medium text-blue-400`}>
                    {program.time}
                  </Text>
                  <Text className="text-sm text-gray-500">
                    {program.duration}
                  </Text>
                </View>
                <Text className={`${textSize} flex-1 text-white`}>
                  {program.title}
                </Text>
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          <View className="mt-8 flex-row space-x-4">
            <TouchableOpacity
              className={`flex-1 rounded-lg border border-gray-600 ${buttonSize}`}
            >
              <Text className="text-center text-white">⏰ Set Reminder</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-1 rounded-lg border border-gray-600 ${buttonSize}`}
            >
              <Text className="text-center text-white">
                ⭐ Add to Favorites
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
