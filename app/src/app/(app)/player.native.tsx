import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useRef } from 'react';

import { Pressable, SafeAreaView, Text, View } from '@/components/ui';
import { ExpoVideoPlayerView } from '@/components/video/ExpoVideoPlayerView';
import type { PlayerId } from '@/components/video/players';
import {
  AVAILABLE_PLAYERS,
  getDefaultPlayerId,
} from '@/components/video/players';
import { VlcPlayerView } from '@/components/video/VlcPlayerView';
import { useSourceCredentials } from '@/lib/source-credentials';
import { constructStreamUrl } from '@/lib/stream-url';
import { openDb } from '@/lib/db';

// eslint-disable-next-line max-lines-per-function
export default function Player() {
  const router = useRouter();
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

  const [state, setState] = React.useState<{
    loading: boolean;
    error?: string | null;
    url?: string;
  }>({ loading: true });

  const [selectedPlayer, setSelectedPlayer] =
    React.useState<PlayerId>(getDefaultPlayerId());
  const getCredsRef = useRef(getCredentials);
  getCredsRef.current = getCredentials;
  const lastRequestKeyRef = useRef<string | null>(null);
  const requestKey = useMemo(() => {
    if (!params.playlist || !content) return null;
    return `${params.playlist}|${content.type}|${content.id}`;
  }, [params.playlist, content]);

  React.useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        if (!requestKey || !params.playlist || !content) {
          throw new Error('Missing identifiers');
        }
        if (lastRequestKeyRef.current === requestKey) return;
        lastRequestKeyRef.current = requestKey;
        const creds = await getCredsRef.current(String(params.playlist), {
          title: 'Play Content',
          message: 'Enter your passphrase to decrypt the source',
        });
        // Prefer locally stored movie container extension (per item) if available
        let containerExtension: string | undefined;
        let videoCodec: string | undefined = creds.videoCodec;
        let audioCodec: string | undefined = creds.audioCodec;
        if (content.type === 'movie') {
          try {
            const db = await openDb();
            const rows = await db.getAllAsync<{
              container_extension: string | null;
              video_codec: string | null;
              audio_codec: string | null;
            }>(
              `SELECT me.container_extension, me.video_codec, me.audio_codec
               FROM movies_ext me
               JOIN content_items ci ON ci.id = me.item_id
               WHERE ci.source_id = $source_id
                 AND ci.source_item_id = $source_item_id
                 AND ci.type = 'movie'
               LIMIT 1`,
              {
                $source_id: String(params.playlist),
                $source_item_id: String(content.id),
              }
            );
            const first = rows && rows[0];
            if (first) {
              if (first.container_extension)
                containerExtension = String(first.container_extension);
              if (first.video_codec) videoCodec = String(first.video_codec);
              if (first.audio_codec) audioCodec = String(first.audio_codec);
            }
          } catch {}
        }
        const { streamingUrl } = constructStreamUrl({
          server: creds.server,
          username: creds.username,
          password: creds.password,
          contentId: Number(content.id),
          contentType: content.type,
          containerExtension,
          videoCodec,
          audioCodec,
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
  }, [requestKey, params.playlist, content, content?.id, content?.type]);

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
            <Text className="text-center text-white">Loading player…</Text>
          ) : state.error ? (
            <Text className="text-center text-red-400">{state.error}</Text>
          ) : state.url ? (
            <>
              <View className="px-3 pb-3">
                <View className="flex-row gap-2">
                  {AVAILABLE_PLAYERS.map((p) => (
                    <Pressable
                      key={p.id}
                      className={`rounded-md px-3 py-2 ${
                        selectedPlayer === p.id ? 'bg-white/20' : 'bg-white/10'
                      }`}
                      onPress={() => setSelectedPlayer(p.id)}
                    >
                      <Text className="text-xs text-white">{p.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {selectedPlayer === 'vlc' ? (
                <VlcPlayerView
                  url={state.url}
                  showBack
                  onBack={() => router.back()}
                />
              ) : (
                <ExpoVideoPlayerView
                  url={state.url}
                  showBack
                  onBack={() => router.back()}
                />
              )}
            </>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
