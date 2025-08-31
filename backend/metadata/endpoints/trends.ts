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

export type TrendsContentType = 'movie' | 'tv';

export interface TrendItem {
  rank: number;
  content_type: TrendsContentType;
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

function makeKey(feed: TrendFeed, contentType: TrendsContentType): string {
  return `trakt:${feed}:${contentType}`;
}

async function getTrends(key: string): Promise<TrendsResponse | null> {
  const row = await metadataDB.queryRow<{
    key: string;
    run_at: Date;
    items: any;
  }>`SELECT key, run_at, items FROM trends WHERE key = ${key}`;
  log.info('getTrends', { key, hasRow: !!row });
  if (!row) return null;

  // Handle date parsing more robustly
  const runAtDate =
    row.run_at instanceof Date ? row.run_at : new Date(row.run_at);

  // Parse and return the data
  const parsedItems = Array.isArray(row.items)
    ? row.items
    : JSON.parse(String(row.items || '[]'));

  log.info('getTrends:returning_data', { key, item_count: parsedItems.length });

  return {
    key: row.key,
    run_at: runAtDate.toISOString(),
    items: parsedItems,
    count: parsedItems.length,
  };
}

async function storeTrends(key: string, items: TrendItem[]): Promise<void> {
  await metadataDB.exec`
    INSERT INTO trends (key, run_at, items)
    VALUES (${key}, CURRENT_TIMESTAMP, ${JSON.stringify(items)})
    ON CONFLICT (key) DO UPDATE SET run_at = EXCLUDED.run_at, items = EXCLUDED.items
  `;
}

function normalizeItem(
  raw: any,
  contentType: TrendsContentType,
  idx: number,
  feed: TrendFeed
): TrendItem | null {
  const core = contentType === 'tv' ? raw?.show ?? raw : raw?.movie ?? raw;
  if (!core?.ids?.trakt) return null;
  const ids = core.ids || {};
  const title = core.title || '';
  const year = core.year || null;
  const traktId = Number(ids.trakt);
  const tmdb = ids.tmdb != null ? Number(ids.tmdb) : null;

  const metrics: Record<string, number> = {};
  if (feed === 'trending' && typeof raw?.watchers === 'number')
    metrics.watchers = raw.watchers;
  if (feed === 'watched_weekly' && typeof raw?.watcher_count === 'number')
    metrics.watchers = raw.watcher_count;
  if (feed === 'played_weekly' && typeof raw?.play_count === 'number')
    metrics.plays = raw.play_count;
  if (feed === 'collected_weekly' && typeof raw?.collected_count === 'number')
    metrics.collected = raw.collected_count;
  if (feed === 'anticipated' && typeof raw?.list_count === 'number')
    metrics.list_count = raw.list_count;

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

async function fetchFromTrakt(
  feed: TrendFeed,
  contentType: TrendsContentType,
  limit: number
): Promise<TrendItem[]> {
  const client = new TraktClient();
  log.info('fetchFromTrakt:start', { feed, contentType, limit });
  let items: any[] | null = null;
  switch (feed) {
    case 'trending':
      items = await client.getTrending(contentType, limit);
      break;
    case 'popular': {
      items = await client.getPopular(contentType, limit);
      break;
    }
    case 'watched_weekly': {
      const endpoint =
        contentType === 'tv'
          ? '/shows/watched/weekly'
          : '/movies/watched/weekly';
      items =
        (await (client as any).makeRequest?.call(
          client,
          endpoint + `?limit=${limit}`
        )) ?? null;
      break;
    }
    case 'played_weekly': {
      const endpoint =
        contentType === 'tv' ? '/shows/played/weekly' : '/movies/played/weekly';
      items =
        (await (client as any).makeRequest?.call(
          client,
          endpoint + `?limit=${limit}`
        )) ?? null;
      break;
    }
    case 'collected_weekly': {
      const endpoint =
        contentType === 'tv'
          ? '/shows/collected/weekly'
          : '/movies/collected/weekly';
      items =
        (await (client as any).makeRequest?.call(
          client,
          endpoint + `?limit=${limit}`
        )) ?? null;
      break;
    }
    case 'anticipated': {
      const endpoint =
        contentType === 'tv' ? '/shows/anticipated' : '/movies/anticipated';
      items =
        (await (client as any).makeRequest?.call(
          client,
          endpoint + `?limit=${limit}`
        )) ?? null;
      break;
    }
    case 'releases': {
      // last 14 days of releases
      if (contentType !== 'movie') {
        items = [];
        break;
      }
      const start = new Date();
      const endpoint = `/calendars/all/movies/releases/${start
        .toISOString()
        .slice(0, 10)}/14`;
      items =
        (await (client as any).makeRequest?.call(client, endpoint)) ?? null;
      break;
    }
    case 'premieres': {
      if (contentType !== 'tv') {
        items = [];
        break;
      }
      const start = new Date();
      const endpoint = `/calendars/all/shows/premieres/${start
        .toISOString()
        .slice(0, 10)}/14`;
      items =
        (await (client as any).makeRequest?.call(client, endpoint)) ?? null;
      break;
    }
    default:
      items = [];
  }

  if (!items) {
    log.warn('fetchFromTrakt:empty_items', { feed, contentType, limit });
  } else {
    log.info('fetchFromTrakt:items_received', {
      feed,
      contentType,
      limit,
      count: items.length,
    });
  }

  if (!items) return [];
  const normalized: TrendItem[] = [];
  for (let i = 0; i < Math.min(items.length, limit); i++) {
    const n = normalizeItem(items[i], contentType, i, feed);
    if (n) normalized.push(n);
  }
  log.info('fetchFromTrakt:normalized', {
    feed,
    contentType,
    limit,
    normalizedCount: normalized.length,
  });
  return normalized;
}

// DB-only fetch endpoint (no remote calls)
export const getTrendsFromDB = api(
  { expose: true, auth: false, method: 'GET', path: '/metadata/trends' },
  async ({
    feed,
    content_type,
    limit,
  }: {
    feed: TrendFeed;
    content_type: TrendsContentType;
    limit?: number;
  }): Promise<TrendsResponse> => {
    log.info('getTrendsFromDB:start', { feed, content_type, limit });
    if (!feed) throw APIError.invalidArgument('feed is required');
    if (content_type !== 'movie' && content_type !== 'tv')
      throw APIError.invalidArgument('invalid content_type');
    const key = makeKey(feed, content_type);
    const stored = await getTrends(key);
    if (stored) {
      log.info('getTrendsFromDB:found', { key, count: stored.count });
      return limit && limit > 0
        ? {
            ...stored,
            items: stored.items.slice(0, limit),
            count: Math.min(stored.count, limit),
          }
        : stored;
    }
    log.info('getTrendsFromDB:no_data', { key });
    return {
      key,
      run_at: new Date().toISOString(),
      items: [],
      count: 0,
    };
  }
);

// Update endpoint: fetch from Trakt and store in database
export const updateTrends = api(
  {
    expose: false,
    auth: false,
    method: 'POST',
    path: '/metadata/trends/update',
  },
  async ({
    feed,
    content_type,
    limit,
  }: {
    feed: TrendFeed;
    content_type: TrendsContentType;
    limit?: number;
  }): Promise<TrendsResponse> => {
    log.info('updateTrends:start', { feed, content_type, limit });
    if (!feed) throw APIError.invalidArgument('feed is required');
    if (content_type !== 'movie' && content_type !== 'tv')
      throw APIError.invalidArgument('invalid content_type');
    const key = makeKey(feed, content_type);
    const items = await fetchFromTrakt(feed, content_type, limit ?? 100);
    if (!items || items.length === 0) {
      log.warn('updateTrends:empty_from_trakt', { key });
      const current = await getTrends(key);
      return (
        current || {
          key,
          run_at: new Date().toISOString(),
          items: [],
          count: 0,
        }
      );
    }
    await storeTrends(key, items);
    log.info('updateTrends:written', { key, count: items.length });
    return {
      key,
      run_at: new Date().toISOString(),
      items,
      count: items.length,
    };
  }
);

export async function refreshTrendsKey(
  feed: TrendFeed,
  contentType: TrendsContentType,
  limit: number
): Promise<TrendsResponse> {
  const key = makeKey(feed, contentType);
  log.info('refreshTrendsKey:start', { key, feed, contentType, limit });
  const t0 = Date.now();
  log.info('refreshTrendsKey:fetching', { key, feed, contentType, limit });
  const items = await fetchFromTrakt(feed, contentType, limit);
  const dt = Date.now() - t0;
  log.info('refreshTrendsKey:fetched', { key, count: items.length, ms: dt });
  if (items.length === 0) {
    log.warn('refreshTrendsKey:empty_result_skip_write', { key, ms: dt });
    const current = await getTrends(key);
    return (
      current || {
        key,
        run_at: new Date().toISOString(),
        items: [],
        count: 0,
      }
    );
  }
  log.info('refreshTrendsKey:writing', { key, count: items.length, ms: dt });
  await storeTrends(key, items);
  log.info('refreshTrendsKey:written', { key, count: items.length, ms: dt });
  return {
    key,
    run_at: new Date().toISOString(),
    items,
    count: items.length,
  };
}
