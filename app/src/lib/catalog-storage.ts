'use client';

import { openDb } from './db';

export interface CatalogData {
  categories?: any[];
  movies?: any[];
  series?: any[];
  channels?: any[];
}

export interface CatalogStats {
  total: number;
  movies: number;
  series: number;
  channels: number;
  lastUpdated?: string;
  sizeBytes?: number;
}

// legacy keys kept for reference only
// const _catalogKey = (sourceId: string) => `catalog:${sourceId}`;
// const _statsKey = (sourceId: string) => `catalog:stats:${sourceId}`;

export class MobileCatalogStorage {
  async storeSourceCatalog(
    accountId: string,
    sourceId: string,
    data: CatalogData,
    server?: string
  ): Promise<void> {
    const db = await openDb();
    if (__DEV__) console.log('[store] begin', sourceId);
    const safeData: CatalogData = {
      categories: data.categories || [],
      movies: data.movies || [],
      series: data.series || [],
      channels: data.channels || [],
    };

    const now = new Date().toISOString();
    const srcId = sourceId;
    await db.execAsync('BEGIN');
    try {
      await db.runAsync(
        `INSERT INTO sources (account_id, id, name, kind, base_url, created_at, updated_at)
         VALUES ($account_id, $id, $name, $kind, $base_url, $created_at, $updated_at)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, kind=excluded.kind, base_url=excluded.base_url, updated_at=excluded.updated_at`,
        {
          $account_id: accountId,
          $id: srcId,
          $name: 'Source',
          $kind: 'xtream',
          $base_url: server || null,
          $created_at: now,
          $updated_at: now,
        }
      );
      await this.insertCategories(
        db,
        accountId,
        srcId,
        safeData.categories || []
      );
      await this.insertMovies(db, accountId, srcId, safeData.movies || []);
      await this.insertSeries(db, accountId, srcId, safeData.series || []);
      await this.insertChannels(db, accountId, srcId, safeData.channels || []);

      await db.execAsync('COMMIT');
      if (__DEV__)
        console.log('[store] commit', {
          categories: safeData.categories?.length || 0,
          movies: safeData.movies?.length || 0,
          series: safeData.series?.length || 0,
          channels: safeData.channels?.length || 0,
        });
    } catch (e) {
      await db.execAsync('ROLLBACK');
      if (__DEV__) console.log('[store] rollback', e);
      throw e;
    }
  }

  private async insertCategories(
    db: Awaited<ReturnType<typeof openDb>>,
    accountId: string,
    srcId: string,
    categories: any[]
  ) {
    for (const cat of categories) {
      const sourceCategoryId = String(cat.category_id ?? cat.id ?? '');
      const id = `${srcId}:${String(cat.type ?? 'generic')}:${sourceCategoryId}`;
      await db.runAsync(
        `INSERT OR IGNORE INTO categories (account_id, id, source_id, source_category_id, name, type)
         VALUES ($account_id, $id, $source_id, $source_category_id, $name, $type)`,
        {
          $account_id: accountId,
          $id: id,
          $source_id: srcId,
          $source_category_id: sourceCategoryId,
          $name: String(cat.category_name ?? cat.name ?? ''),
          $type: String(cat.type ?? 'generic'),
        }
      );
    }
  }

  private async insertMovies(
    db: Awaited<ReturnType<typeof openDb>>,
    accountId: string,
    srcId: string,
    movies: any[]
  ) {
    for (const m of movies) {
      const sourceItemId = String(m.stream_id ?? m.num ?? '');
      const itemId = `${srcId}:movie:${sourceItemId}`;
      const poster = String(m.stream_icon ?? '');
      // Extract tmdb id if present under common provider keys
      const tmdbId = String(m.tmdb_id ?? m.tmdb ?? '').trim() || null;
      await db.runAsync(
        `INSERT OR IGNORE INTO content_items (account_id, id, source_id, source_item_id, type, title, description, poster_url, backdrop_url, release_date, rating, rating_5based, is_adult, added_at, last_modified, popularity, original_payload_json, tmdb_id)
         VALUES ($account_id, $id, $source_id, $source_item_id, 'movie', $title, $description, $poster_url, $backdrop_url, $release_date, $rating, $rating_5based, $is_adult, $added_at, $last_modified, NULL, $payload, $tmdb_id)`,
        {
          $account_id: accountId,
          $id: itemId,
          $source_id: srcId,
          $source_item_id: sourceItemId,
          $title: String(m.name ?? ''),
          $description: null,
          $poster_url: poster,
          $backdrop_url: null,
          $release_date: null,
          $rating: Number(m.rating ?? 0) || 0,
          $rating_5based: Number(m.rating_5based ?? 0) || 0,
          $is_adult: Number(m.is_adult ?? 0) || 0,
          $added_at: m.added
            ? new Date(Number(m.added) * 1000).toISOString()
            : null,
          $last_modified: null,
          $payload: JSON.stringify(m),
          $tmdb_id: tmdbId,
        }
      );
      // If the row already exists, ensure tmdb_id is backfilled (once)
      if (tmdbId) {
        await db.runAsync(
          `UPDATE content_items SET tmdb_id = COALESCE(tmdb_id, $tmdb_id) WHERE id = $id`,
          { $id: itemId, $tmdb_id: tmdbId }
        );
      }
      // Link item to its category if present
      if (m.category_id != null) {
        const categoryId = `${srcId}:vod:${String(m.category_id)}`;
        await db.runAsync(
          `INSERT OR IGNORE INTO content_item_categories (item_id, category_id)
           VALUES ($item_id, $category_id)`,
          { $item_id: itemId, $category_id: categoryId }
        );
      }
    }
  }

  private async insertSeries(
    db: Awaited<ReturnType<typeof openDb>>,
    accountId: string,
    srcId: string,
    series: any[]
  ) {
    for (const s of series) {
      const sourceItemId = String(s.series_id ?? s.num ?? '');
      const itemId = `${srcId}:series:${sourceItemId}`;
      const poster = String(s.cover ?? '');
      const backdropCandidate = Array.isArray(s.backdrop_path)
        ? String(s.backdrop_path[0] ?? '')
        : null;
      const backdrop = backdropCandidate || '';
      const tmdbId = String(s.tmdb_id ?? s.tmdb ?? '').trim() || null;
      await db.runAsync(
        `INSERT OR IGNORE INTO content_items (account_id, id, source_id, source_item_id, type, title, description, poster_url, backdrop_url, release_date, rating, rating_5based, is_adult, added_at, last_modified, popularity, original_payload_json, tmdb_id)
         VALUES ($account_id, $id, $source_id, $source_item_id, 'series', $title, $description, $poster_url, $backdrop_url, $release_date, $rating, $rating_5based, 0, $added_at, $last_modified, NULL, $payload, $tmdb_id)`,
        {
          $account_id: accountId,
          $id: itemId,
          $source_id: srcId,
          $source_item_id: sourceItemId,
          $title: String(s.name ?? ''),
          $description: String(s.plot ?? ''),
          $poster_url: poster,
          $backdrop_url: backdrop,
          $release_date: String(s.release_date ?? s.releaseDate ?? '') || null,
          $rating: Number(s.rating ?? 0) || 0,
          $rating_5based: Number(s.rating_5based ?? 0) || 0,
          $added_at: null,
          $last_modified: s.last_modified
            ? new Date(Number(s.last_modified) * 1000).toISOString()
            : null,
          $payload: JSON.stringify(s),
          $tmdb_id: tmdbId,
        }
      );
      if (tmdbId) {
        await db.runAsync(
          `UPDATE content_items SET tmdb_id = COALESCE(tmdb_id, $tmdb_id) WHERE id = $id`,
          { $id: itemId, $tmdb_id: tmdbId }
        );
      }
      // Link item to its category if present
      if (s.category_id != null) {
        const categoryId = `${srcId}:series:${String(s.category_id)}`;
        await db.runAsync(
          `INSERT OR IGNORE INTO content_item_categories (item_id, category_id)
           VALUES ($item_id, $category_id)`,
          { $item_id: itemId, $category_id: categoryId }
        );
      }
    }
  }

  private async insertChannels(
    db: Awaited<ReturnType<typeof openDb>>,
    accountId: string,
    srcId: string,
    channels: any[]
  ) {
    for (const c of channels) {
      const sourceItemId = String(c.stream_id ?? c.num ?? '');
      const itemId = `${srcId}:live:${sourceItemId}`;
      const poster = String(c.stream_icon ?? '');
      await db.runAsync(
        `INSERT OR IGNORE INTO content_items (account_id, id, source_id, source_item_id, type, title, description, poster_url, backdrop_url, release_date, rating, rating_5based, is_adult, added_at, last_modified, popularity, original_payload_json)
         VALUES ($account_id, $id, $source_id, $source_item_id, 'live', $title, NULL, $poster_url, NULL, NULL, 0, 0, $is_adult, $added_at, NULL, NULL, $payload)`,
        {
          $account_id: accountId,
          $id: itemId,
          $source_id: srcId,
          $source_item_id: sourceItemId,
          $title: String(c.name ?? ''),
          $poster_url: poster,
          $is_adult: Number(c.is_adult ?? 0) || 0,
          $added_at: c.added
            ? new Date(Number(c.added) * 1000).toISOString()
            : null,
          $payload: JSON.stringify(c),
        }
      );
      // Link item to its category if present
      if (c.category_id != null) {
        const categoryId = `${srcId}:live:${String(c.category_id)}`;
        await db.runAsync(
          `INSERT OR IGNORE INTO content_item_categories (item_id, category_id)
           VALUES ($item_id, $category_id)`,
          { $item_id: itemId, $category_id: categoryId }
        );
      }
    }
  }

  async getSourceCatalog(_sourceId: string): Promise<CatalogData | null> {
    // Optional: return null to encourage using SQL queries directly
    return null;
  }

  async getCatalogStats(
    accountId: string,
    sourceId: string
  ): Promise<CatalogStats> {
    const db = await openDb();
    const res = await db.getFirstAsync<{
      movies: number;
      series: number;
      channels: number;
    }>(
      `SELECT
         SUM(CASE WHEN type='movie' THEN 1 ELSE 0 END) AS movies,
         SUM(CASE WHEN type='series' THEN 1 ELSE 0 END) AS series,
         SUM(CASE WHEN type='live' THEN 1 ELSE 0 END) AS channels
       FROM content_items WHERE account_id = $account_id AND source_id = $source_id`,
      { $account_id: accountId, $source_id: sourceId }
    );
    const movies = res?.movies || 0;
    const series = res?.series || 0;
    const channels = res?.channels || 0;
    return { total: movies + series + channels, movies, series, channels };
  }

  async clearSourceData(accountId: string, sourceId: string): Promise<void> {
    const db = await openDb();
    await db.runAsync(
      'DELETE FROM sources WHERE id = $id AND account_id = $account_id',
      { $id: sourceId, $account_id: accountId }
    );
  }
}

// helper moved to url-utils.ts
