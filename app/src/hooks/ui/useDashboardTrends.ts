/* eslint-disable unicorn/filename-case */
import { useQueries } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { openDb } from '@/lib/db';
import { createQueryOptions, queryKeys } from '@/lib/query-utils';

// Helper function to query local SQLite database for movie/series details
async function getContentItemData(
  id: string | number,
  type: 'movie' | 'series'
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
      WHERE ci.tmdb_id = ? AND ci.type = ?`,
      [stringId, type]
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
        WHERE ci.id = ? AND ci.type = ?`,
        [stringId, type]
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
async function getLiveItemData(id: string | number) {
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
      WHERE ci.id = ? AND ci.type = 'live'`,
      [stringId]
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
  type: 'movie' | 'series' | 'live'
) {
  if (type === 'live') {
    const data = await getLiveItemData(id);
    if (!data) {
      console.warn(`No local data found for ${type} with ID: ${id}`);
    }
    return data;
  }

  const data = await getContentItemData(id, type);
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

// Helper function to enhance trends response with local poster data
async function enhanceTrendsResponse(
  response: TrendsFeedResponse,
  contentType: 'movie' | 'tv'
): Promise<TrendsFeedResponse> {
  const localType = contentType === 'tv' ? 'series' : 'movie';
  const enhancedItems = await Promise.all(
    (response.items || []).map(async (item) => {
      if (!item.tmdb_id)
        return {
          ...item,
          poster_path: item.poster_path ?? null,
          local_id: null,
        };
      const local = await getContentItemData(
        String(item.tmdb_id),
        localType as any
      );
      const poster = (local as any)?.poster_url || null;
      return {
        ...item,
        poster_path: poster,
        local_id: (local as any)?.id || null,
      } as TrendItem;
    })
  );

  return {
    ...response,
    items: enhancedItems,
    count: enhancedItems.length,
  };
}

export function useDashboardTrends(): UseDashboardTrendsResult {
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
      ...createQueryOptions('MEDIUM_LIVED'),
    })),
  });

  const movies = movieQueries.reduce<
    Partial<Record<TrendFeed, TrendsFeedResponse | null>>
  >((acc, q, idx) => {
    acc[DASHBOARD_TREND_FEEDS[idx]] = q.data || null;
    return acc;
  }, {});

  const series = seriesQueries.reduce<
    Partial<Record<TrendFeed, TrendsFeedResponse | null>>
  >((acc, q, idx) => {
    acc[DASHBOARD_TREND_FEEDS[idx]] = q.data || null;
    return acc;
  }, {});

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
