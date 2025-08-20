import React, { useMemo, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, View, Text, Pressable } from '@/components/ui';
import { useSourceCredentials } from '@/lib/source-credentials';
import { constructStreamUrl } from '@/lib/stream-url';
import { Platform } from 'react-native';
import VlcPlayerView from '@/components/video/VlcPlayerView';

export default function Player() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    playlist?: string;
    movie?: string;
    series?: string;
    live?: string;
  }>();
  const { getCredentials } = useSourceCredentials();
  const playerRef = useRef<any>(null);

  const content = useMemo(() => {
    if (params.movie) return { id: params.movie, type: 'movie' as const };
    if (params.series) return { id: params.series, type: 'series' as const };
    if (params.live) return { id: params.live, type: 'live' as const };
    return null;
  }, [params.movie, params.series, params.live]);

  const [state, setState] = React.useState<{
    loading: boolean;
    error?: string | null;
    url?: string;
  }>({ loading: true });

  React.useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        if (!params.playlist || !content)
          throw new Error('Missing identifiers');
        const creds = await getCredentials(String(params.playlist), {
          title: 'Play Content',
          message: 'Enter your passphrase to decrypt the source',
        });
        const { streamingUrl } = constructStreamUrl({
          server: creds.server,
          username: creds.username,
          password: creds.password,
          contentId: Number(content.id),
          contentType: content.type,
          containerExtension: creds.containerExtension,
          videoCodec: creds.videoCodec,
          audioCodec: creds.audioCodec,
        });
        if (!mounted) return;
        setState({ loading: false, url: streamingUrl });
      } catch (e) {
        if (!mounted) return;
        setState({
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to build stream URL',
        });
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [params.playlist, content?.id, content?.type]);

  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 bg-black">
        <View className="p-3">
          <Pressable
            onPress={() => router.back()}
            className="rounded-md bg-white/10 px-3 py-2"
          >
            <Text className="text-white">Back</Text>
          </Pressable>
        </View>
        <View className="flex-1 items-stretch justify-center">
          {state.loading ? (
            <Text className="text-white text-center">Loading player…</Text>
          ) : state.error ? (
            <Text className="text-red-400 text-center">{state.error}</Text>
          ) : state.url ? (
            <VlcPlayerView
              url={state.url}
              showBack
              onBack={() => router.back()}
            />
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
