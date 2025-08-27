import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { SafeAreaView, Text, View } from '@/components/ui';
import { VideoPlayer } from '@/components/video';
import { useWebPlaybackSource } from '@/components/video/web-player/useWebPlaybackSource';

export default function Player() {
  const router = useRouter();
  const { url, loading, error, contentType } = useWebPlaybackSource();

  // You can also get theme/layout preferences from params or user settings
  const params = useLocalSearchParams();
  const layout = (params.layout as 'netflix' | 'minimal') || 'netflix';
  const theme = (params.theme as 'default' | 'compact') || 'default';

  if (loading) {
    return (
      <SafeAreaView className="flex-1">
        <View className="flex-1 bg-black items-center justify-center">
          <Text className="text-white">Loading player…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1">
        <View className="flex-1 bg-black items-center justify-center">
          <Text className="text-red-400">{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!url) {
    return (
      <SafeAreaView className="flex-1">
        <View className="flex-1 bg-black items-center justify-center">
          <Text className="text-white">No video URL provided</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 bg-black">
        <VideoPlayer
          url={url}
          title={params.title as string}
          type={contentType}
          showBack
          onBack={() => router.back()}
          layout={layout}
          theme={theme}
          preferredPlayer="auto" // Will auto-select based on platform and file type
        />
      </View>
    </SafeAreaView>
  );
}
