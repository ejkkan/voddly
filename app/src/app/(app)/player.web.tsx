import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';

import { Pressable, SafeAreaView, Text, View } from '@/components/ui';
import { WebPlayerView } from '@/components/video/web-player-view';
import { useSourceCredentials } from '@/lib/source-credentials';
import { getContainerInfoForContent } from '@/lib/container-extension';
import { constructStreamUrl } from '@/lib/stream-url';

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
        <WebPlayerView
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
  const params = useLocalSearchParams<{
    playlist?: string;
    movie?: string;
    series?: string;
    live?: string;
  }>();
  const { getCredentials } = useSourceCredentials();

  const content = useMemo(() => {
    if (params.movie) return { id: params.movie, type: 'movie' as const };
    if (params.series) return { id: params.series, type: 'series' as const };
    if (params.live) return { id: params.live, type: 'live' as const };
    return null;
  }, [params.movie, params.series, params.live]);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [url, setUrl] = React.useState<string | undefined>(undefined);

  // Note: keep logic simple; rely on containerExtension fix for both movies and series

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
        // Prefer locally stored container extension (per item) if available
        let containerExtension: string | undefined;
        let videoCodec: string | undefined = creds.videoCodec;
        let audioCodec: string | undefined = creds.audioCodec;
        let playbackContentId: number | string = Number(content.id);
        try {
          const info = await getContainerInfoForContent(
            content.type,
            String(params.playlist),
            String(content.id)
          );
          containerExtension = info.containerExtension || containerExtension;
          videoCodec = info.videoCodec || videoCodec;
          audioCodec = info.audioCodec || audioCodec;
          if (info.playbackContentId)
            playbackContentId = info.playbackContentId;
        } catch {}
        const { streamingUrl } = constructStreamUrl({
          server: creds.server,
          username: creds.username,
          password: creds.password,
          contentId: playbackContentId,
          contentType: content.type,
          // Use per-item container extension if present; otherwise allow inference/default
          containerExtension,
          videoCodec,
          audioCodec,
        });
        if (!mounted) return;
        setUrl(streamingUrl);
        setLoading(false);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to build stream URL');
        setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [params.playlist, content, content?.id, content?.type, getCredentials]);

  const body = loading ? (
    <Text className="text-center text-white">Loading player…</Text>
  ) : error ? (
    <Text className="text-center text-red-400">{error}</Text>
  ) : (
    <PlayerContent url={url} contentType={content?.type} />
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
