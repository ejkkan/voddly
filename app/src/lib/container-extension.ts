'use client';

import { openDb } from '@/lib/db';

// Simple in-memory cache to avoid repeated database queries during playback
const containerInfoCache = new Map<string, ContainerInfo>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

function getCacheKey(type: string, sourceId: string, sourceItemId: string | number): string {
  return `${type}:${sourceId}:${sourceItemId}`;
}

function getCachedInfo(cacheKey: string): ContainerInfo | null {
  const timestamp = cacheTimestamps.get(cacheKey);
  if (!timestamp || Date.now() - timestamp > CACHE_TTL) {
    containerInfoCache.delete(cacheKey);
    cacheTimestamps.delete(cacheKey);
    return null;
  }
  return containerInfoCache.get(cacheKey) || null;
}

function setCachedInfo(cacheKey: string, info: ContainerInfo): void {
  containerInfoCache.set(cacheKey, info);
  cacheTimestamps.set(cacheKey, Date.now());
}

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
  const cacheKey = getCacheKey('movie', sourceId, String(sourceItemId));
  
  // Check cache first
  const cached = getCachedInfo(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    const db = await openDb();
    // Use getFirstAsync instead of getAllAsync for better performance
    const result = await db.getFirstAsync<{
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
    
    const info = {
      containerExtension: result?.container_extension || undefined,
      videoCodec: result?.video_codec || undefined,
      audioCodec: result?.audio_codec || undefined,
    };
    
    // Cache the result
    setCachedInfo(cacheKey, info);
    return info;
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
  const cacheKey = getCacheKey('series', sourceId, String(sourceItemId));
  
  // Check cache first
  const cached = getCachedInfo(cacheKey);
  if (cached) {
    return cached;
  }
  
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
      const info = {
        containerExtension: directEp.container_extension || undefined,
        playbackContentId: String(sourceItemId),
      };
      setCachedInfo(cacheKey, info);
      return info;
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
    
    const info = {
      containerExtension: ep?.container_extension || undefined,
      playbackContentId: ep?.stream_id || undefined,
    };
    
    // Cache the result
    setCachedInfo(cacheKey, info);
    return info;
  } catch {
    return {};
  }
}

/**
 * Read live/TV container info.
 * For live streams, the source_item_id is the actual stream_id to use for playback.
 * Browsers typically need HLS (.m3u8) format for live streaming.
 */
export async function getContainerInfoForLive(
  sourceId: string,
  sourceItemId: string | number
): Promise<ContainerInfo> {
  // For browser playback, we must use HLS format (.m3u8)
  // as most IPTV services provide HLS streams
  return {
    containerExtension: 'm3u8',
    // Most live streams use h264/aac
    videoCodec: 'h264',
    audioCodec: 'aac',
    // For live streams, the source_item_id IS the stream_id
    playbackContentId: sourceItemId,
  };
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
  if (type === 'live') return getContainerInfoForLive(sourceId, sourceItemId);
  return {};
}
