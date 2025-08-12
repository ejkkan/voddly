import React from 'react';
import { ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { View, Text } from '@/components/ui';
import { isTV } from '@/lib/platform';

// Mock data - replace with actual data from your API
const mockPlaylists = [
  { id: '1', name: 'Sports Channels', channelCount: 45, icon: '⚽' },
  { id: '2', name: 'Movies Premium', channelCount: 120, icon: '🎬' },
  { id: '3', name: 'News & Documentary', channelCount: 30, icon: '📰' },
  { id: '4', name: 'Kids & Family', channelCount: 25, icon: '👨‍👩‍👧‍👦' },
  { id: '5', name: 'Music Channels', channelCount: 50, icon: '🎵' },
  { id: '6', name: 'International', channelCount: 80, icon: '🌍' },
];

export default function PlaylistsScreen() {
  const renderPlaylistItem = ({
    item,
  }: {
    item: (typeof mockPlaylists)[0];
  }) => (
    <TouchableOpacity
      className={`${
        isTV ? 'p-6' : 'p-4'
      } mb-3 flex-row items-center rounded-lg bg-gray-100 dark:bg-gray-800`}
    >
      <Text className={`${isTV ? 'text-4xl' : 'text-3xl'} mr-4`}>
        {item.icon}
      </Text>
      <View className="flex-1">
        <Text
          className={`${
            isTV ? 'text-xl' : 'text-lg'
          } font-semibold text-gray-900 dark:text-white`}
        >
          {item.name}
        </Text>
        <Text
          className={`${
            isTV ? 'text-base' : 'text-sm'
          } text-gray-600 dark:text-gray-400`}
        >
          {item.channelCount} channels
        </Text>
      </View>
      <Text className="text-gray-400">›</Text>
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
          Your Playlists
        </Text>
        <Text
          className={`${
            isTV ? 'text-lg' : 'text-base'
          } mt-2 text-gray-600 dark:text-gray-400`}
        >
          Select a playlist to browse channels
        </Text>
      </View>

      <FlatList
        data={mockPlaylists}
        renderItem={renderPlaylistItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  );
}
