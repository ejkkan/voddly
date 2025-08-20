import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from '@/components/ui';
import { openDb } from '@/lib/db';

type SeasonRow = {
  season_number: number;
  episodes: number;
};

export function SeasonsList(props: {
  seriesItemId: string;
  onSeasonPress?: (seasonNumber: number) => void;
}) {
  const { seriesItemId, onSeasonPress } = props;
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const db = await openDb();
        const rows = await db.getAllAsync<SeasonRow>(
          `SELECT season_number, COUNT(*) as episodes
           FROM episodes_ext
           WHERE series_item_id = $series_item_id
           GROUP BY season_number
           ORDER BY season_number ASC`,
          { $series_item_id: String(seriesItemId) }
        );
        if (mounted) setSeasons(rows || []);
      } catch {
        if (mounted) setSeasons([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [seriesItemId]);

  if (loading) return null;
  if (!seasons || seasons.length === 0) return null;

  return (
    <View className="mt-6">
      <Text className="mb-2 text-xl font-bold text-neutral-900 dark:text-neutral-50">
        Seasons
      </Text>
      <View className="gap-2">
        {seasons.map((s) => (
          <Pressable
            key={s.season_number}
            className="flex-row items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900"
            onPress={() => onSeasonPress?.(Number(s.season_number))}
          >
            <Text className="text-neutral-900 dark:text-neutral-50">
              Season {Number(s.season_number)}
            </Text>
            <Text className="text-neutral-600 dark:text-neutral-400">
              {Number(s.episodes)} episode{Number(s.episodes) === 1 ? '' : 's'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
