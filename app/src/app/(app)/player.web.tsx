import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';

import { Pressable, SafeAreaView, Text, View } from '@/components/ui';
import { WebPlayer } from '@/components/video/web-player';
import { useWebPlaybackSource } from '@/components/video/web-player/useWebPlaybackSource';

function PlayerContent({
  url,
  contentType,
}: {
  url?: string;
  contentType?: 'movie' | 'series' | 'live';
}) {
  const router = useRouter();
  return (
    <View className="flex-1 items-stretch justify-center">
      {!url ? null : (
        <WebPlayer
          url={url}
          title={undefined}
          showBack
          onBack={() => router.back()}
          movieId={undefined}
          tmdbId={undefined}
          type={contentType}
        />
      )}
    </View>
  );
}

function BackBar() {
  const router = useRouter();
  return (
    <View className="p-3">
      <Pressable
        onPress={() => router.back()}
        className="rounded-md bg-white/10 px-3 py-2"
      >
        <Text className="text-white">Back</Text>
      </Pressable>
    </View>
  );
}

export default function Player() {
  const { url, loading, error, contentType } = useWebPlaybackSource();

  const body = loading ? (
    <Text className="text-center text-white">Loading player…</Text>
  ) : error ? (
    <Text className="text-center text-red-400">{error}</Text>
  ) : (
    <PlayerContent url={url} contentType={contentType} />
  );

  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 bg-black">
        <BackBar />
        {body}
      </View>
    </SafeAreaView>
  );
}
