import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { useFetchRemoteMovie } from '@/hooks/useFetchRemoteMovie';
import { openDb } from '@/lib/db';
import { useSourceCredentials } from '@/lib/source-credentials';
import { constructStreamUrl } from '@/lib/stream-url';

type ItemRow = {
  id: string;
  source_id: string;
  source_item_id: string;
  type: string;
  title: string;
  description?: string | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
  release_date?: string | null;
  rating?: number | null;
  rating_5based?: number | null;
  original_payload_json?: string;
};

export default function MovieDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ItemRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { prepareContentPlayback } = useSourceCredentials();
  const {
    fetchRemote,
    isFetching: fetching,
    error: fetchError,
  } = useFetchRemoteMovie();
  const refreshedForIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        if (!id) {
          if (mounted) setLoading(false);
          return;
        }
        const db = await openDb();
        const row = await db.getFirstAsync<ItemRow>(
          `SELECT * FROM content_items WHERE id = $id`,
          { $id: String(id) }
        );
        if (mounted) setItem(row ?? null);
        if (mounted) setLoading(false);
        // Fetch remote in background once per item id and refresh if changed
        if (row && refreshedForIdRef.current !== row.id) {
          refreshedForIdRef.current = row.id;
          fetchRemote({
            id: row.id,
            sourceId: row.source_id,
            sourceItemId: row.source_item_id,
          })
            .then(async (ok) => {
              try {
                if (!ok || !mounted) return;
                const db2 = await openDb();
                const updated = await db2.getFirstAsync<ItemRow>(
                  `SELECT * FROM content_items WHERE id = $id`,
                  { $id: String(row.id) }
                );
                if (mounted) setItem(updated ?? row);
              } catch {
                // ignore refresh errors
              }
            })
            .catch(() => {
              // ignore
            });
        }
      } finally {
        // loading ended after local read
      }
    };
    run();
    return () => {
      mounted = false;
    };
    // Intentionally depend only on id to avoid reruns when background fetch toggles fetching state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handlePlay = async () => {
    try {
      if (!item) return;
      // source_id is of the form `${sourceId}:type:...` for content_items.id, but here we stored source_id as raw source id
      const sourceId = item.source_id;
      const sourceItemId = item.source_item_id;
      await prepareContentPlayback({
        sourceId,
        contentId: sourceItemId,
        contentType: 'movie',
        options: {
          title: 'Play Movie',
          message: 'Enter your passphrase to play the movie',
        },
      });
      // Navigate to player route (to be implemented) with identifiers
      router.push({
        pathname: '/(app)/player',
        params: { playlist: sourceId, movie: String(sourceItemId) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to prepare playback');
    }
  };

  // Derive audio codec (if available) from the stored provider payload
  const audioCodec = useMemo(() => {
    try {
      const raw = item?.original_payload_json
        ? JSON.parse(item.original_payload_json)
        : null;
      const codec = String(raw?.info?.audio?.codec_name || '')
        .trim()
        .toLowerCase();
      return codec || null;
    } catch {
      return null;
    }
  }, [item?.original_payload_json]);

  const isUnsupportedAudioOnWeb = useMemo(() => {
    if (Platform.OS !== 'web') return false;
    if (!audioCodec) return false;
    return (
      audioCodec === 'eac3' || audioCodec === 'ac3' || audioCodec === 'dts'
    );
  }, [audioCodec]);

  const handleOpenInVlc = async () => {
    try {
      if (!item) return;
      const sourceId = item.source_id;
      const sourceItemId = item.source_item_id;
      // Get credentials to build direct provider URL

      const prep = await prepareContentPlayback({
        sourceId,
        contentId: sourceItemId,
        contentType: 'movie',
        options: {
          title: 'Open in VLC',
          message: 'Enter your passphrase to generate the stream URL',
        },
      });
      const { streamingUrl } = constructStreamUrl({
        server: prep.credentials.server,
        username: prep.credentials.username,
        password: prep.credentials.password,
        contentId: sourceItemId,
        contentType: 'movie',
        containerExtension: prep.credentials.containerExtension,
        videoCodec: prep.credentials.videoCodec,
        audioCodec: prep.credentials.audioCodec,
      });
      // Build platform-specific deep link
      const httpUrl = streamingUrl;
      const deepLink = (() => {
        if (Platform.OS === 'ios') {
          return `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(
            httpUrl
          )}`;
        }
        // Android/web default
        return `vlc://${httpUrl}`;
      })();

      if (Platform.OS === 'web') {
        try {
          const ua = (navigator.userAgent || '').toLowerCase();
          const isAndroid = ua.includes('android');
          const intentLink = isAndroid
            ? ((): string => {
                try {
                  const u = new URL(httpUrl);
                  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=http;package=org.videolan.vlc;S.browser_fallback_url=${encodeURIComponent(
                    'https://www.videolan.org/vlc/'
                  )};end`;
                } catch {
                  return '';
                }
              })()
            : '';
          const linkToUse = isAndroid && intentLink ? intentLink : deepLink;
          // Use a temporary <a> to trigger the protocol handler without auto-opening the HTTP URL
          const a = document.createElement('a');
          a.href = linkToUse;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(async () => {
            // If no handler, copy URL and show guidance instead of downloading in a new tab
            try {
              await navigator.clipboard?.writeText(httpUrl);
            } catch {}
            setError(
              'Could not open VLC automatically. URL copied – open VLC and use Open Network Stream.'
            );
            try {
              document.body.removeChild(a);
            } catch {}
          }, 1200);
        } catch {
          // Swallow – user can use Copy URL / Get VLC buttons
        }
      } else {
        // Native: attempt deep link via Linking if available
        try {
          // Dynamically import to avoid web bundling issues
          const { Linking } = await import('react-native');
          const supported = await Linking.canOpenURL(deepLink);
          if (supported) await Linking.openURL(deepLink);
          else await Linking.openURL(httpUrl as any);
        } catch {
          // swallow
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open in VLC');
    }
  };

  const handleFetchFresh = async () => {
    if (!item) return;
    const ok = await fetchRemote({
      id: item.id,
      sourceId: item.source_id,
      sourceItemId: item.source_item_id,
    });
    if (ok) {
      const db = await openDb();
      const row = await db.getFirstAsync<ItemRow>(
        `SELECT * FROM content_items WHERE id = $id`,
        { $id: String(item.id) }
      );
      setItem(row ?? null);
    }
  };

  return (
    <SafeAreaView className="flex-1">
      <ScrollView className="flex-1 bg-white dark:bg-black">
        <View className="p-4">
          <Pressable className="mb-3" onPress={() => router.back()}>
            <Text className="text-neutral-600 dark:text-neutral-300">Back</Text>
          </Pressable>
          {loading ? (
            <Text className="text-neutral-900 dark:text-neutral-50">
              Loading…
            </Text>
          ) : !item ? (
            <Text className="text-neutral-900 dark:text-neutral-50">
              Not found
            </Text>
          ) : (
            <View>
              <View className="overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-900">
                {item.backdrop_url || item.poster_url ? (
                  <Image
                    source={{ uri: item.backdrop_url || item.poster_url || '' }}
                    contentFit="cover"
                    className="h-56 w-full md:h-72"
                  />
                ) : null}
              </View>
              <Text className="mt-4 text-2xl font-extrabold text-neutral-900 dark:text-neutral-50">
                {item.title}
              </Text>
              <View className="mt-2 flex-row items-center gap-2">
                {item.release_date ? (
                  <Text className="text-neutral-600 dark:text-neutral-400">
                    {String(item.release_date).slice(0, 4)}
                  </Text>
                ) : null}
                {typeof item.rating_5based === 'number' ? (
                  <Text className="text-neutral-600 dark:text-neutral-400">
                    • ⭐ {item.rating_5based}/5
                  </Text>
                ) : null}
                <Text className="text-neutral-600 dark:text-neutral-400">
                  • HD
                </Text>
              </View>
              {item.description ? (
                <Text className="mt-3 text-neutral-800 dark:text-neutral-200">
                  {item.description}
                </Text>
              ) : null}
              <View className="mt-4 flex-row gap-3">
                <Pressable
                  className="rounded-xl bg-neutral-900 px-4 py-2"
                  onPress={handlePlay}
                >
                  <Text className="text-white">Play</Text>
                </Pressable>
                <Pressable
                  className="rounded-xl border border-neutral-300 px-4 py-2 dark:border-neutral-700"
                  onPress={handleFetchFresh}
                >
                  <Text className="text-neutral-900 dark:text-neutral-50">
                    {fetching ? 'Fetching…' : 'Fetch Remote'}
                  </Text>
                </Pressable>
              </View>
              {isUnsupportedAudioOnWeb ? (
                <View className="mt-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3">
                  <Text className="text-sm text-yellow-300">
                    Audio may not work in the browser for this title
                    (E-AC-3/AC-3/DTS). Use the app for full playback.
                  </Text>
                  <View className="mt-2 flex-row gap-2">
                    <Pressable
                      className="rounded-md bg-white/10 px-3 py-2"
                      onPress={handleOpenInVlc}
                    >
                      <Text className="text-xs text-white">Open in VLC</Text>
                    </Pressable>
                    <Pressable
                      className="rounded-md bg-white/10 px-3 py-2"
                      onPress={() => {
                        try {
                          window.open(
                            'https://www.videolan.org/vlc/',
                            '_blank'
                          );
                        } catch {}
                      }}
                    >
                      <Text className="text-xs text-white">Get VLC</Text>
                    </Pressable>
                    <Pressable
                      className="rounded-md bg-white/10 px-3 py-2"
                      onPress={async () => {
                        try {
                          const prep = await prepareContentPlayback({
                            sourceId: item.source_id,
                            contentId: item.source_item_id,
                            contentType: 'movie',
                            options: { title: 'Copy URL' },
                          });
                          const { streamingUrl } = constructStreamUrl({
                            server: prep.credentials.server,
                            username: prep.credentials.username,
                            password: prep.credentials.password,
                            contentId: item.source_item_id,
                            contentType: 'movie',
                            containerExtension:
                              prep.credentials.containerExtension,
                            videoCodec: prep.credentials.videoCodec,
                            audioCodec: prep.credentials.audioCodec,
                          });
                          await navigator.clipboard?.writeText(streamingUrl);
                        } catch {}
                      }}
                    >
                      <Text className="text-xs text-white">Copy URL</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              {error ? (
                <Text className="mt-2 text-red-600 dark:text-red-400">
                  {error}
                </Text>
              ) : null}
              {fetchError ? (
                <Text className="mt-2 text-red-600 dark:text-red-400">
                  {fetchError}
                </Text>
              ) : null}
              {/* Extra info from original payload if available */}
              {item.original_payload_json
                ? (() => {
                    try {
                      const raw = JSON.parse(
                        item.original_payload_json || '{}'
                      );
                      const duration = raw?.duration;
                      const genre = raw?.genre;
                      const plot = raw?.plot;
                      return (
                        <View className="mt-4 gap-2">
                          {plot ? (
                            <Text className="text-neutral-700 dark:text-neutral-300">
                              {plot}
                            </Text>
                          ) : null}
                          <View className="flex-row gap-3">
                            {duration ? (
                              <Text className="text-neutral-600 dark:text-neutral-400">
                                Duration: {String(duration)}
                              </Text>
                            ) : null}
                            {genre ? (
                              <Text className="text-neutral-600 dark:text-neutral-400">
                                Genre: {String(genre)}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    } catch {
                      return null;
                    }
                  })()
                : null}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
