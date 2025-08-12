import React from 'react';
import { FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { View, Text } from '@/components/ui';
import { isTV } from '@/lib/platform';

// Mock data - replace with actual data
const mockChannels = [
  {
    id: '1',
    name: 'Sports HD',
    category: 'Sports',
    icon: '⚽',
    isLive: true,
    currentProgram: 'Live Football Match',
  },
  {
    id: '2',
    name: 'News 24',
    category: 'News',
    icon: '📰',
    isLive: true,
    currentProgram: 'Breaking News',
  },
  {
    id: '3',
    name: 'Movie Plus',
    category: 'Movies',
    icon: '🎬',
    isLive: true,
    currentProgram: 'Action Thriller',
  },
  {
    id: '4',
    name: 'Kids TV',
    category: 'Kids',
    icon: '🎨',
    isLive: true,
    currentProgram: 'Cartoon Adventures',
  },
  {
    id: '5',
    name: 'Music Hits',
    category: 'Music',
    icon: '🎵',
    isLive: true,
    currentProgram: 'Top 40 Countdown',
  },
  {
    id: '6',
    name: 'Documentary',
    category: 'Documentary',
    icon: '🌍',
    isLive: true,
    currentProgram: 'Nature Wildlife',
  },
  {
    id: '7',
    name: 'Comedy Central',
    category: 'Entertainment',
    icon: '😂',
    isLive: true,
    currentProgram: 'Stand-up Special',
  },
  {
    id: '8',
    name: 'Tech TV',
    category: 'Technology',
    icon: '💻',
    isLive: true,
    currentProgram: 'Tech News Today',
  },
];

export default function LiveScreen() {
  const router = useRouter();

  const handleChannelPress = (channelId: string) => {
    // Navigate to live channel player
    router.push(`/live/${channelId}`);
  };

  const renderChannelItem = ({ item }: { item: (typeof mockChannels)[0] }) => (
    <TouchableOpacity
      onPress={() => handleChannelPress(item.id)}
      className={`${
        isTV ? 'p-6' : 'p-4'
      } mb-3 flex-row items-center rounded-lg bg-gray-100 dark:bg-gray-800`}
    >
      <View className="mr-4 items-center justify-center">
        <Text className={`${isTV ? 'text-4xl' : 'text-3xl'}`}>{item.icon}</Text>
        {item.isLive && (
          <View className="mt-1 flex-row items-center">
            <View className="mr-1 h-2 w-2 rounded-full bg-red-500" />
            <Text className="text-xs text-red-500">LIVE</Text>
          </View>
        )}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center">
          <Text
            className={`${
              isTV ? 'text-xl' : 'text-lg'
            } font-semibold text-gray-900 dark:text-white`}
          >
            {item.name}
          </Text>
          <View className="ml-2 rounded bg-blue-100 px-2 py-1 dark:bg-blue-900">
            <Text className="text-xs text-blue-700 dark:text-blue-300">
              {item.category}
            </Text>
          </View>
        </View>
        <Text
          className={`${
            isTV ? 'text-base' : 'text-sm'
          } mt-1 text-gray-600 dark:text-gray-400`}
        >
          Now: {item.currentProgram}
        </Text>
      </View>

      <Text className="text-2xl text-gray-400">›</Text>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <View className="p-4">
        <Text
          className={`${
            isTV ? 'text-3xl' : 'text-2xl'
          } font-bold text-gray-900 dark:text-white`}
        >
          Live Channels
        </Text>
        <Text
          className={`${
            isTV ? 'text-lg' : 'text-base'
          } mt-2 text-gray-600 dark:text-gray-400`}
        >
          Watch live TV channels
        </Text>
      </View>

      <FlatList
        data={mockChannels}
        renderItem={renderChannelItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  );
}
