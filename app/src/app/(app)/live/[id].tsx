import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  SafeAreaView,
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
} from '@/components/ui';
import { useSourceCredentials } from '@/lib/source-credentials';
import { openDb } from '@/lib/db';

type ItemRow = {
  id: string;
  source_id: string;
  source_item_id: string;
  type: string;
  title: string;
  poster_url?: string | null;
  rating?: number | null;
};

export default function LiveDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ItemRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { prepareContentPlayback } = useSourceCredentials();

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        if (!id) return;
        const db = await openDb();
        const row = await db.getFirstAsync<ItemRow>(
          `SELECT id, source_id, source_item_id, type, title, poster_url, rating FROM content_items WHERE id = $id`,
          { $id: String(id) }
        );
        if (mounted) setItem(row ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handlePlay = async () => {
    try {
      if (!item) return;
      const sourceId = item.source_id;
      const channelId = item.source_item_id;
      await prepareContentPlayback(sourceId, channelId, 'live', {
        title: 'Play Channel',
        message: 'Enter your passphrase to play the channel',
      });
      router.push({
        pathname: '/(app)/player',
        params: { playlist: sourceId, live: String(channelId) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to prepare playback');
    }
  };

  return (
    <SafeAreaView>
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
                {item.poster_url ? (
                  <Image
                    source={{ uri: item.poster_url || '' }}
                    contentFit="cover"
                    className="h-40 w-full md:h-56"
                  />
                ) : null}
              </View>
              <Text className="mt-4 text-2xl font-extrabold text-neutral-900 dark:text-neutral-50">
                {item.title}
              </Text>
              <View className="mt-2 flex-row items-center gap-2">
                {typeof item.rating === 'number' ? (
                  <Text className="text-neutral-600 dark:text-neutral-400">
                    ⭐ {item.rating}
                  </Text>
                ) : null}
              </View>
              <View className="mt-4 flex-row gap-3">
                <Pressable
                  className="rounded-xl bg-neutral-900 px-4 py-2"
                  onPress={handlePlay}
                >
                  <Text className="text-white">Start Watching</Text>
                </Pressable>
              </View>
              {error ? (
                <Text className="mt-2 text-red-600 dark:text-red-400">
                  {error}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
