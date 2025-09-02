/* eslint-disable unicorn/filename-case */
import { useQueries } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { openDb } from '@/lib/db';
import { createQueryOptions, queryKeys } from '@/lib/query-utils';

// Helper function to query local SQLite database for movie/series details
async function getContentItemData(
  id: string | number,
  type: 'movie' | 'series',
  accountId?: string
) {
  try {
    const db = await openDb();
    const stringId = String(id);

    let contentItem;

    // First try to find by TMDB ID (for consistency with dashboard)
    contentItem = await db.getFirstAsync<{
      id: string;
      title: string;
      description: string | null;
      poster_url: string | null;
      backdrop_url: string | null;
      release_date: string | null;
      rating: number | null;
      type: string;
      tmdb_id: string | null;
      source_item_id: string;
      source_id: string;
      original_payload_json: string;
    }>(
      `SELECT
        ci.id,
        ci.title,
        ci.description,
        ci.poster_url,
        ci.backdrop_url,
        ci.release_date,
        ci.rating,
        ci.type,
        ci.tmdb_id,
        ci.source_item_id,
        ci.source_id,
        ci.original_payload_json
      FROM content_items ci
      WHERE ci.tmdb_id = ? AND ci.type = ?${accountId ? ' AND ci.account_id = ?' : ''}`,
      accountId ? [stringId, type, accountId] : [stringId, type]
    );

    // If not found by TMDB ID, try by local database ID (fallback)
    if (!contentItem) {
      contentItem = await db.getFirstAsync<{
        id: string;
        title: string;
        description: string | null;
        poster_url: string | null;
        backdrop_url: string | null;
        release_date: string | null;
        rating: number | null;
        type: string;
        tmdb_id: string | null;
        source_item_id: string;
        source_id: string;
        original_payload_json: string;
      }>(
        `SELECT
          ci.id,
          ci.title,
          ci.description,
          ci.poster_url,
          ci.backdrop_url,
          ci.release_date,
          ci.rating,
          ci.type,
          ci.tmdb_id,
          ci.source_item_id,
          ci.source_id,
          ci.original_payload_json
        FROM content_items ci
        WHERE ci.id = ? AND ci.type = ?${accountId ? ' AND ci.account_id = ?' : ''}`,
        accountId ? [stringId, type, accountId] : [stringId, type]
      );
    }

    if (!contentItem) return null;

    // For series, also get series-specific data
    if (type === 'series') {
      const seriesData = await db.getFirstAsync<{
        tmdb_id: string | null;
        episode_run_time: number | null;
      }>(
        'SELECT tmdb_id, episode_run_time FROM series_ext WHERE item_id = ?',
        contentItem.id // Use the actual database ID for the join
      );

      return {
        ...contentItem,
        seriesData: seriesData || null,
      };
    }

    return contentItem;
  } catch (error) {
    console.error(
      `Error querying local database for ${type} with ID ${id}:`,
      error
    );
    return null;
  }
}

// Helper function to query local SQLite database for live content details
async function getLiveItemData(id: string | number, accountId?: string) {
  try {
    const db = await openDb();
    const stringId = String(id);

    const liveItem = await db.getFirstAsync<{
      id: string;
      title: string;
      description: string | null;
      poster_url: string | null;
      backdrop_url: string | null;
      type: string;
      source_item_id: string;
      source_id: string;
      original_payload_json: string;
    }>(
      `SELECT
        ci.id,
        ci.title,
        ci.description,
        ci.poster_url,
        ci.backdrop_url,
        ci.type,
        ci.source_item_id,
        ci.source_id,
        ci.original_payload_json
      FROM content_items ci
      WHERE ci.id = ? AND ci.type = 'live'${accountId ? ' AND ci.account_id = ?' : ''}`,
      accountId ? [stringId, accountId] : [stringId]
    );

    if (!liveItem) return null;

    // Get live-specific data
    const liveData = await db.getFirstAsync<{
      channel_number: number | null;
      epg_channel_id: string | null;
      tv_archive: number | null;
      tv_archive_duration: number | null;
    }>(
      `SELECT channel_number, epg_channel_id, tv_archive, tv_archive_duration
      FROM live_ext WHERE item_id = ?`,
      [stringId]
    );

    return {
      ...liveItem,
      liveData: liveData || null,
    };
  } catch (error) {
    console.error(
      `Error querying local database for live content with ID ${id}:`,
      error
    );
    return null;
  }
}

// Main function to query local SQLite database for item details
export async function getLocalItemData(
  id: string | number,
  type: 'movie' | 'series' | 'live',
  accountId?: string
) {
  if (type === 'live') {
    const data = await getLiveItemData(id, accountId);
    if (!data) {
      console.warn(`No local data found for ${type} with ID: ${id}`);
    }
    return data;
  }

  const data = await getContentItemData(id, type, accountId);
  if (!data) {
    console.warn(`No local data found for ${type} with ID: ${id}`);
  }
  return data;
}

export type TrendItem = {
  rank: number;
  content_type: 'movie' | 'tv';
  tmdb_id?: number | null;
  trakt_id: number;
  slug?: string | null;
  title: string;
  year?: number | null;
  metrics?: Record<string, number>;
  poster_path?: string | null;
  local_id?: string | null;
};

export type TrendsFeedResponse = {
  key: string;
  run_at: string;
  items: TrendItem[];
  count: number;
};

export const ALL_TREND_FEEDS = [
  'trending',
  'popular',
  'watched_weekly',
  'played_weekly',
  'collected_weekly',
  'anticipated',
  'releases',
  'premieres',
] as const;

export type TrendFeed = (typeof ALL_TREND_FEEDS)[number];

// Feeds currently supported and cached for the dashboard UI
export const DASHBOARD_TREND_FEEDS = [
  'trending',
  'popular',
  'watched_weekly',
  'anticipated',
] as const satisfies readonly TrendFeed[];

export type UseDashboardTrendsResult = {
  movies: Partial<Record<TrendFeed, TrendsFeedResponse | null>>;
  series: Partial<Record<TrendFeed, TrendsFeedResponse | null>>;
  isLoading: boolean;
  error?: Error | null;
};

// Batch query function to get multiple items at once
async function getBatchContentData(
  tmdbIds: string[],
  type: 'movie' | 'series'
) {
  if (tmdbIds.length === 0) return new Map<string, any>();

  try {
    const db = await openDb();
    const placeholders = tmdbIds.map(() => '?').join(',');

    const query = `
      SELECT
        ci.id,
        ci.title,
        ci.poster_url,
        ci.tmdb_id,
        ci.type
      FROM content_items ci
      WHERE ci.tmdb_id IN (${placeholders}) AND ci.type = ?
    `;

    const results = await db.getAllAsync<{
      id: string;
      title: string;
      poster_url: string | null;
      tmdb_id: string;
      type: string;
    }>(query, [...tmdbIds, type]);

    // Create a map for O(1) lookups
    const dataMap = new Map<string, any>();
    for (const item of results) {
      if (item.tmdb_id) {
        dataMap.set(item.tmdb_id, item);
      }
    }

    return dataMap;
  } catch (error) {
    console.error('Error in batch query:', error);
    return new Map<string, any>();
  }
}

// Helper function to enhance trends response with local poster data
async function enhanceTrendsResponse(
  response: TrendsFeedResponse,
  contentType: 'movie' | 'tv'
): Promise<TrendsFeedResponse> {
  const localType = contentType === 'tv' ? 'series' : 'movie';

  // Collect all TMDB IDs that need to be looked up
  const tmdbIds = response.items
    .filter((item) => item.tmdb_id)
    .map((item) => String(item.tmdb_id));

  // Single batch query for all items
  const localDataMap = await getBatchContentData(tmdbIds, localType);

  // Map the results back to items
  const enhancedItems = response.items.map((item) => {
    if (!item.tmdb_id) {
      return {
        ...item,
        poster_path: item.poster_path ?? null,
        local_id: null,
      };
    }

    const local = localDataMap.get(String(item.tmdb_id));
    return {
      ...item,
      poster_path: local?.poster_url || null,
      local_id: local?.id || null,
    } as TrendItem;
  });

  return {
    ...response,
    items: enhancedItems,
    count: enhancedItems.length,
  };
}

/**
 * Hook to fetch dashboard trends with optional enabled flag
 *
 * @example
 * // Only fetch trends when on dashboard route
 * const { movies, series, isLoading } = useDashboardTrends(useIsDashboardRoute());
 *
 * @param enabled - Whether the trends queries should be enabled (default: true)
 * @returns Object containing movie trends, series trends, loading state, and errors
 */
export function useDashboardTrends(enabled = true): UseDashboardTrendsResult {
  // Movie feeds
  const movieQueries = useQueries({
    queries: DASHBOARD_TREND_FEEDS.map((feed) => ({
      queryKey: queryKeys.dashboard.trends.movie(feed),
      queryFn: async () => {
        const response = await apiClient.user.getDashboardTrends({
          feed,
          content_type: 'movie',
          limit: 20,
        });
        return enhanceTrendsResponse(response, 'movie');
      },
      enabled,
      ...createQueryOptions('MEDIUM_LIVED'),
    })),
  });

  // Series feeds
  const seriesQueries = useQueries({
    queries: DASHBOARD_TREND_FEEDS.map((feed) => ({
      queryKey: queryKeys.dashboard.trends.series(feed),
      queryFn: async () => {
        const response = await apiClient.user.getDashboardTrends({
          feed,
          content_type: 'tv',
          limit: 20,
        });
        return enhanceTrendsResponse(response, 'tv');
      },
      enabled,
      ...createQueryOptions('MEDIUM_LIVED'),
    })),
  });

  const movies = movieQueries.reduce<
    Partial<Record<TrendFeed, TrendsFeedResponse | null>>
  >(
    (acc, q, idx) => {
      acc[DASHBOARD_TREND_FEEDS[idx]] = q.data ?? null;
      return acc;
    },
    {} as Partial<Record<TrendFeed, TrendsFeedResponse | null>>
  );

  const series = seriesQueries.reduce<
    Partial<Record<TrendFeed, TrendsFeedResponse | null>>
  >(
    (acc, q, idx) => {
      acc[DASHBOARD_TREND_FEEDS[idx]] = q.data ?? null;
      return acc;
    },
    {} as Partial<Record<TrendFeed, TrendsFeedResponse | null>>
  );

  const isLoading =
    movieQueries.some((q) => q.isLoading) ||
    seriesQueries.some((q) => q.isLoading);
  const movieError = movieQueries.find((q) => q.error)?.error;
  const seriesError = seriesQueries.find((q) => q.error)?.error;
  const error = (movieError || seriesError) as Error | null;

  return {
    movies,
    series,
    isLoading,
    error,
  };
}
