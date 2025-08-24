'use client';

import { openDb } from '@/lib/db';

export type ContainerInfo = {
  containerExtension?: string;
  videoCodec?: string;
  audioCodec?: string;
  playbackContentId?: string | number;
};

/**
 * Read movie container/codecs from local DB using source identifiers.
 */
export async function getContainerInfoForMovie(
  sourceId: string,
  sourceItemId: string | number
): Promise<ContainerInfo> {
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
      { $source_id: String(sourceId), $source_item_id: String(sourceItemId) }
    );
    const first = rows && rows[0];
    return {
      containerExtension: first?.container_extension || undefined,
      videoCodec: first?.video_codec || undefined,
      audioCodec: first?.audio_codec || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Read series episode container extension from local DB using source identifiers.
 * Picks the earliest episode (lowest season, then episode number).
 */
export async function getContainerInfoForSeries(
  sourceId: string,
  sourceItemId: string | number
): Promise<ContainerInfo> {
  try {
    const db = await openDb();
    // Case 1: The provided id may actually be an EPISODE stream_id. Try direct lookup first.
    const directEp = await db.getFirstAsync<{
      container_extension: string | null;
    }>(
      `SELECT container_extension
       FROM episodes_ext
       WHERE stream_id = $stream_id AND container_extension IS NOT NULL
       LIMIT 1`,
      { $stream_id: String(sourceItemId) }
    );
    if (directEp?.container_extension) {
      return {
        containerExtension: directEp.container_extension || undefined,
        playbackContentId: String(sourceItemId),
      };
    }
    // Look up the series' internal item id
    const seriesRow = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM content_items
       WHERE source_id = $source_id AND source_item_id = $source_item_id AND type = 'series'
       LIMIT 1`,
      { $source_id: String(sourceId), $source_item_id: String(sourceItemId) }
    );
    if (!seriesRow?.id) return {};
    // Get the first episode's stream id and container extension
    const ep = await db.getFirstAsync<{
      stream_id: string | null;
      container_extension: string | null;
    }>(
      `SELECT stream_id, container_extension
       FROM episodes_ext
       WHERE series_item_id = $series_item_id AND container_extension IS NOT NULL
       ORDER BY season_number ASC, episode_number ASC
       LIMIT 1`,
      { $series_item_id: String(seriesRow.id) }
    );
    return {
      containerExtension: ep?.container_extension || undefined,
      playbackContentId: ep?.stream_id || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Convenience wrapper to fetch per-type container info.
 */
export async function getContainerInfoForContent(
  type: 'movie' | 'series' | 'live',
  sourceId: string,
  sourceItemId: string | number
): Promise<ContainerInfo> {
  if (type === 'movie') return getContainerInfoForMovie(sourceId, sourceItemId);
  if (type === 'series')
    return getContainerInfoForSeries(sourceId, sourceItemId);
  return {};
}
