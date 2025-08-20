import React, { useEffect, useMemo, useState } from 'react';
import { View } from '@/components/ui';
import { openDb } from '@/lib/db';
import { CarouselRow } from '@/components/media/carousel-row';
import { PosterCard } from '@/components/media/poster-card';
import { useRouter } from 'expo-router';
import { useSourceCredentials } from '@/lib/source-credentials';

type EpisodeRow = {
  id: string; // composite `${seriesItemId}:${season}:${episode}`
  season_number: number;
  episode_number: number;
  title?: string | null;
  stream_id?: string | null;
  original_payload_json?: string | null;
};

function extractEpisodeImageUrl(payloadJson?: string | null): string | null {
  if (!payloadJson) return null;
  try {
    const payload = JSON.parse(payloadJson);
    const info = payload?.info || {};
    return (
      info.movie_image || info.img || info.cover || info.backdrop_path || null
    );
  } catch {
    return null;
  }
}

export function SeriesEpisodesCarousels(props: {
  seriesItemId: string;
  sourceId: string;
  refreshKey?: string | number;
}) {
  const { seriesItemId, sourceId, refreshKey } = props;
  const [rows, setRows] = useState<EpisodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { prepareContentPlayback } = useSourceCredentials();

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const db = await openDb();
        const eps = await db.getAllAsync<EpisodeRow>(
          `SELECT id, season_number, episode_number, title, stream_id, original_payload_json
           FROM episodes_ext
           WHERE series_item_id = $series_item_id
           ORDER BY season_number ASC, episode_number ASC`,
          { $series_item_id: String(seriesItemId) }
        );
        if (mounted) setRows(eps || []);
      } catch {
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [seriesItemId, refreshKey]);

  const grouped = useMemo(() => {
    const map = new Map<number, EpisodeRow[]>();
    for (const r of rows) {
      const s = Number(r.season_number || 0);
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(r);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([season, eps]) => ({ season, eps }));
  }, [rows]);

  if (loading) return null;
  if (grouped.length === 0) return null;

  return (
    <View className="mt-6">
      {grouped.map(({ season, eps }) => (
        <CarouselRow
          key={`season-${season}`}
          title={`Season ${season}`}
          data={eps.map((e) => ({
            id: e.stream_id || `${seriesItemId}:${season}:${e.episode_number}`,
            title: (e.title && e.title.trim().length > 0
              ? e.title
              : `Episode ${e.episode_number}`) as string,
            imageUrl: extractEpisodeImageUrl(e.original_payload_json) || '',
          }))}
          renderItem={(item) => (
            <PosterCard
              id={item.id}
              title={item.title}
              posterUrl={item.imageUrl}
              onPress={async (id) => {
                try {
                  const streamId = String(id);
                  await prepareContentPlayback(sourceId, streamId, 'series', {
                    title: 'Play Episode',
                    message: 'Enter your passphrase to play this episode',
                  });
                  router.push({
                    pathname: '/(app)/player',
                    params: { playlist: sourceId, series: streamId },
                  });
                } catch {
                  // ignore
                }
              }}
            />
          )}
        />
      ))}
    </View>
  );
}
