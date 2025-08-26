export type TrendItem = {
  rank: number;
  content_type: 'movie' | 'tv';
  tmdb_id?: number | null;
  trakt_id: number;
  slug?: string | null;
  title: string;
  year?: number | null;
  metrics?: Record<string, number>;
};

export type TrendsFeedResponse = {
  key: string;
  run_at: string;
  items: TrendItem[];
  count: number;
};

import { useQuery } from '@tanstack/react-query';
import { getApiRoot } from '@/lib/auth/auth-client';
import { openDb } from '@/lib/db';
import { useActiveAccountId } from './useAccounts';

async function fetchFeed(feed: string, contentType: 'movie' | 'tv', limit = 100): Promise<TrendsFeedResponse | null> {
  const baseApi = getApiRoot();
  const url = `${baseApi}/metadata/trends?feed=${encodeURIComponent(feed)}&content_type=${contentType}&limit=${limit}`;
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) return null;
  return (await res.json()) as TrendsFeedResponse;
}

type LocalItemRow = {
  id: string;
  title: string;
  poster_url?: string | null;
  backdrop_url?: string | null;
  source_id?: string | null;
  tmdb_id?: string | null;
};

async function fetchLocalItemsByTmdbIds(
  accountId: string | undefined,
  type: 'movie' | 'tv',
  tmdbIds: number[]
): Promise<Map<string, LocalItemRow>> {
  const map = new Map<string, LocalItemRow>();
  if (!tmdbIds || tmdbIds.length === 0) return map;
  const db = await openDb();
  const placeholders = tmdbIds.map(() => '?').join(',');
  const params: any[] = [];
  const where: string[] = [];
  where.push(`type = ${type === 'movie' ? `'movie'` : `'series'`}`);
  if (accountId) {
    where.push(`account_id = ?`);
    params.push(accountId);
  }
  // tmdb_id is stored as TEXT
  params.push(...tmdbIds.map((id) => String(id)));
  const sql = `SELECT id, title, poster_url, backdrop_url, source_id, tmdb_id FROM content_items WHERE ${where.join(
    ' AND '
  )} AND tmdb_id IN (${placeholders})`;
  const rows = (await db.getAllAsync(sql, params)) as LocalItemRow[];
  for (const r of rows) {
    const key = String(r.tmdb_id || '').trim();
    if (key && !map.has(key)) {
      map.set(key, r);
    }
  }
  return map;
}

export type UiTrendItem = {
  id: string; // local content_items.id
  title: string;
  posterUrl?: string | null;
  tmdbId?: number | null;
  sourceId?: string | null;
};

export type UseDashboardTrendsResult = {
  trendingMovies: UiTrendItem[];
  trendingSeries: UiTrendItem[];
  isLoading: boolean;
  error?: Error | null;
};

export function useDashboardTrends(limitPerRow = 20): UseDashboardTrendsResult {
  const { accountId, isLoading: accountsLoading } = useActiveAccountId();

  const query = useQuery({
    queryKey: ['ui', 'dashboard', 'trends', limitPerRow, accountId ?? null],
    enabled: !accountsLoading,
    queryFn: async (): Promise<{ movies: UiTrendItem[]; series: UiTrendItem[] }> => {
      const [feedMovies, feedSeries] = await Promise.all([
        fetchFeed('trending', 'movie', 100),
        fetchFeed('trending', 'tv', 100),
      ]);

      const movieTmdbIds = (feedMovies?.items || [])
        .map((i) => (i.tmdb_id == null ? null : Number(i.tmdb_id)))
        .filter((n): n is number => Number.isFinite(n));
      const seriesTmdbIds = (feedSeries?.items || [])
        .map((i) => (i.tmdb_id == null ? null : Number(i.tmdb_id)))
        .filter((n): n is number => Number.isFinite(n));

      const [localMoviesMap, localSeriesMap] = await Promise.all([
        fetchLocalItemsByTmdbIds(accountId || undefined, 'movie', movieTmdbIds),
        fetchLocalItemsByTmdbIds(accountId || undefined, 'tv', seriesTmdbIds),
      ]);

      const mapOrdered = (
        feed: TrendsFeedResponse | null,
        localMap: Map<string, LocalItemRow>
      ): UiTrendItem[] => {
        if (!feed) return [];
        const out: UiTrendItem[] = [];
        for (const item of feed.items) {
          const key = item.tmdb_id == null ? '' : String(item.tmdb_id);
          if (!key) continue;
          const local = localMap.get(key);
          if (!local) continue;
          out.push({
            id: local.id,
            title: local.title || item.title,
            posterUrl: local.poster_url || local.backdrop_url || null,
            tmdbId: item.tmdb_id ?? undefined,
            sourceId: local.source_id || undefined,
          });
          if (out.length >= limitPerRow) break;
        }
        return out;
      };

      const movies = mapOrdered(feedMovies, localMoviesMap);
      const series = mapOrdered(feedSeries, localSeriesMap);
      return { movies, series };
    },
    staleTime: 300_000,
    gcTime: 900_000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  return {
    trendingMovies: query.data?.movies || [],
    trendingSeries: query.data?.series || [],
    isLoading: query.isLoading,
    error: (query.error as Error) || null,
  };
}