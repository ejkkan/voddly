import { api, APIError } from 'encore.dev/api';
import log from 'encore.dev/log';
import { metadataDB } from '../db';
import { TraktClient } from '../providers/trakt-client';

export type TrendFeed =
  | 'trending'
  | 'popular'
  | 'watched_weekly'
  | 'played_weekly'
  | 'collected_weekly'
  | 'anticipated'
  | 'releases'
  | 'premieres';

export type ContentType = 'movie' | 'tv';

export interface TrendItem {
  rank: number;
  content_type: ContentType;
  tmdb_id?: number | null;
  trakt_id: number;
  slug?: string | null;
  title: string;
  year?: number | null;
  metrics?: Record<string, number>;
  event_date?: string | null;
}

export interface TrendsResponse {
  key: string;
  run_at: string;
  items: TrendItem[];
  count: number;
}

const FRESH_MS = 1000 * 60 * 60; // 1 hour freshness window

function makeKey(feed: TrendFeed, contentType: ContentType): string {
  return `trakt:${feed}:${contentType}`;
}

async function getCached(key: string): Promise<TrendsResponse | null> {
  const row = await metadataDB.queryRow<{
    key: string;
    run_at: Date;
    items: any;
  }>`SELECT key, run_at, items FROM trends_cache WHERE key = ${key}`;
  if (!row) return null;
  const age = Date.now() - new Date(row.run_at).getTime();
  if (age > FRESH_MS) return null;
  const items = Array.isArray(row.items) ? row.items : JSON.parse(String(row.items || '[]'));
  return {
    key: row.key,
    run_at: new Date(row.run_at).toISOString(),
    items,
    count: items.length,
  };
}

async function setCached(key: string, items: TrendItem[]): Promise<void> {
  await metadataDB.exec`
    INSERT INTO trends_cache (key, run_at, items)
    VALUES (${key}, CURRENT_TIMESTAMP, ${JSON.stringify(items)})
    ON CONFLICT (key) DO UPDATE SET run_at = EXCLUDED.run_at, items = EXCLUDED.items
  `;
}

function normalizeItem(raw: any, contentType: ContentType, idx: number, feed: TrendFeed): TrendItem | null {
  const core = contentType === 'tv' ? raw?.show : raw?.movie || raw;
  if (!core?.ids?.trakt) return null;
  const ids = core.ids || {};
  const title = core.title || '';
  const year = core.year || null;
  const traktId = Number(ids.trakt);
  const tmdb = ids.tmdb != null ? Number(ids.tmdb) : null;

  const metrics: Record<string, number> = {};
  if (feed === 'trending' && typeof raw?.watchers === 'number') metrics.watchers = raw.watchers;
  if (feed === 'watched_weekly' && typeof raw?.watcher_count === 'number') metrics.watchers = raw.watcher_count;
  if (feed === 'played_weekly' && typeof raw?.play_count === 'number') metrics.plays = raw.play_count;
  if (feed === 'collected_weekly' && typeof raw?.collected_count === 'number') metrics.collected = raw.collected_count;
  if (feed === 'anticipated' && typeof raw?.list_count === 'number') metrics.list_count = raw.list_count;

  let eventDate: string | null = null;
  if (feed === 'releases') eventDate = raw?.released || null;
  if (feed === 'premieres') eventDate = raw?.first_aired || null;

  return {
    rank: idx + 1,
    content_type: contentType,
    tmdb_id: tmdb,
    trakt_id: traktId,
    slug: core.ids?.slug || null,
    title,
    year,
    metrics: Object.keys(metrics).length ? metrics : undefined,
    event_date: eventDate,
  };
}

async function fetchFromTrakt(feed: TrendFeed, contentType: ContentType, limit: number): Promise<TrendItem[]> {
  const client = new TraktClient();
  let items: any[] | null = null;
  switch (feed) {
    case 'trending':
      items = await client.getTrending(contentType, limit);
      break;
    case 'popular': {
      const endpoint = contentType === 'tv' ? '/shows/popular' : '/movies/popular';
      items = (await (client as any).makeRequest?.call(client, endpoint)) ?? null;
      break;
    }
    case 'watched_weekly': {
      const endpoint = contentType === 'tv' ? '/shows/watched/weekly' : '/movies/watched/weekly';
      items = (await (client as any).makeRequest?.call(client, endpoint + `?limit=${limit}`)) ?? null;
      break;
    }
    case 'played_weekly': {
      const endpoint = contentType === 'tv' ? '/shows/played/weekly' : '/movies/played/weekly';
      items = (await (client as any).makeRequest?.call(client, endpoint + `?limit=${limit}`)) ?? null;
      break;
    }
    case 'collected_weekly': {
      const endpoint = contentType === 'tv' ? '/shows/collected/weekly' : '/movies/collected/weekly';
      items = (await (client as any).makeRequest?.call(client, endpoint + `?limit=${limit}`)) ?? null;
      break;
    }
    case 'anticipated': {
      const endpoint = contentType === 'tv' ? '/shows/anticipated' : '/movies/anticipated';
      items = (await (client as any).makeRequest?.call(client, endpoint + `?limit=${limit}`)) ?? null;
      break;
    }
    case 'releases': {
      // last 14 days of releases
      const start = new Date();
      const endpoint = `/calendars/all/movies/releases/${start.toISOString().slice(0, 10)}/14`;
      items = (await (client as any).makeRequest?.call(client, endpoint)) ?? null;
      break;
    }
    case 'premieres': {
      const start = new Date();
      const endpoint = `/calendars/all/shows/premieres/${start.toISOString().slice(0, 10)}/14`;
      items = (await (client as any).makeRequest?.call(client, endpoint)) ?? null;
      break;
    }
    default:
      items = [];
  }

  if (!items) return [];
  const normalized: TrendItem[] = [];
  for (let i = 0; i < Math.min(items.length, limit); i++) {
    const n = normalizeItem(items[i], contentType, i, feed);
    if (n) normalized.push(n);
  }
  return normalized;
}

export const getTrends = api(
  { expose: false, auth: false, method: 'GET', path: '/metadata/trends' },
  async ({
    feed,
    content_type,
    limit,
  }: {
    feed: TrendFeed;
    content_type: ContentType;
    limit?: number;
  }): Promise<TrendsResponse> => {
    if (!feed) throw APIError.badRequest('feed is required');
    if (content_type !== 'movie' && content_type !== 'tv') throw APIError.badRequest('invalid content_type');

    const key = makeKey(feed, content_type);

    // Try fresh cache
    const cached = await getCached(key);
    if (cached) return limit && limit > 0 ? { ...cached, items: cached.items.slice(0, limit), count: Math.min(cached.count, limit) } : cached;

    // Fetch from Trakt and cache
    const lim = limit && limit > 0 ? Math.min(limit, 100) : 20;
    const items = await fetchFromTrakt(feed, content_type, lim);
    await setCached(key, items);

    return {
      key,
      run_at: new Date().toISOString(),
      items,
      count: items.length,
    };
  }
);