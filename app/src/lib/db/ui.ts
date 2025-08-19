import { openDb } from './index';

export type CatalogItemType = 'movie' | 'series' | 'live';

export type UiCatalogItem = {
  id: string;
  type: CatalogItemType;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
  categoryId?: string | null;
};

function mapRowToUiItem(row: any): UiCatalogItem {
  const releaseYear = row.release_date
    ? String(row.release_date).slice(0, 4)
    : null;
  const subtitle =
    releaseYear ||
    (typeof row.rating_5based === 'number' ? `${row.rating_5based}/5` : null);
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    subtitle,
    imageUrl: row.poster_url || row.backdrop_url || null,
    rating: typeof row.rating === 'number' ? row.rating : null,
    categoryId: row.category_id ?? null,
  };
}

export async function fetchPreviewByType(
  type: CatalogItemType,
  limit = 10
): Promise<UiCatalogItem[]> {
  const db = await openDb();
  const rows = await db.getAllAsync(
    `SELECT i.id, i.type, i.title, i.poster_url, i.backdrop_url, i.release_date, i.rating, i.rating_5based,
            ic.category_id
     FROM content_items i
     LEFT JOIN content_item_categories ic ON ic.item_id = i.id
     WHERE i.type = $type
     ORDER BY datetime(i.added_at) DESC, i.title ASC
     LIMIT $limit`,
    { $type: type, $limit: limit }
  );
  const items = rows.map(mapRowToUiItem);
  // Debug: inspect what we fetched
  // eslint-disable-next-line no-console
  console.log(`[db/ui] fetchPreviewByType(${type}, limit=${limit}) ->`, items);
  return items;
}

export async function fetchCategoriesWithPreviews(
  type: CatalogItemType,
  limitPerCategory = 20,
  maxCategories = 6
): Promise<
  {
    categoryId: string;
    name: string;
    items: UiCatalogItem[];
  }[]
> {
  const db = await openDb();
  // Map item type to category.type stored during import
  const categoryType = type === 'movie' ? 'vod' : type;
  // Pick some categories for this type
  const cats = (await db.getAllAsync(
    `SELECT c.id, c.name
     FROM categories c
     WHERE c.type = $catType AND c.source_id IN (
       SELECT DISTINCT source_id FROM content_items WHERE type = $itemType
     )
     ORDER BY c.name ASC
     LIMIT $maxCats`,
    { $catType: categoryType, $itemType: type, $maxCats: maxCategories }
  )) as unknown as Array<{ id: string; name: string }>;
  const results: {
    categoryId: string;
    name: string;
    items: UiCatalogItem[];
  }[] = [];
  for (const c of cats) {
    const rows = await db.getAllAsync(
      `SELECT i.id, i.type, i.title, i.poster_url, i.backdrop_url, i.release_date, i.rating, i.rating_5based,
              ic.category_id
       FROM content_items i
       JOIN content_item_categories ic ON ic.item_id = i.id
       WHERE ic.category_id = $category_id AND i.type = $type
       ORDER BY datetime(i.added_at) DESC, i.title ASC
       LIMIT $limit`,
      { $category_id: c.id, $type: type, $limit: limitPerCategory }
    );
    const items = rows.map(mapRowToUiItem);
    results.push({ categoryId: c.id, name: c.name, items });
  }
  // eslint-disable-next-line no-console
  console.log(
    `[db/ui] fetchCategoriesWithPreviews(${type}) ->`,
    results.map((r) => ({ name: r.name, count: r.items.length }))
  );
  return results;
}

export async function fetchDashboardPreviews(limit = 10): Promise<{
  movies: UiCatalogItem[];
  series: UiCatalogItem[];
  live: UiCatalogItem[];
}> {
  const [movies, series, live] = await Promise.all([
    fetchPreviewByType('movie', limit),
    fetchPreviewByType('series', limit),
    fetchPreviewByType('live', limit),
  ]);
  // Debug: inspect dashboard previews
  // eslint-disable-next-line no-console
  console.log('[db/ui] fetchDashboardPreviews ->', {
    moviesLength: movies.length,
    seriesLength: series.length,
    liveLength: live.length,
    sample: {
      movie: movies[0] ?? null,
      series: series[0] ?? null,
      live: live[0] ?? null,
    },
  });
  return { movies, series, live };
}

/**
 * Backfill missing content_item_categories links by reading original payloads.
 * Returns number of links inserted.
 */
export async function backfillMissingItemCategories(): Promise<number> {
  const db = await openDb();
  const rows = await db.getAllAsync(
    `SELECT i.id, i.source_id, i.type, i.original_payload_json
     FROM content_items i
     WHERE NOT EXISTS (
       SELECT 1 FROM content_item_categories ic WHERE ic.item_id = i.id
     )`
  );
  let inserted = 0;
  for (const r of rows as Array<{
    id: string;
    source_id: string;
    type: CatalogItemType;
    original_payload_json?: string;
  }>) {
    try {
      const payload = r.original_payload_json
        ? JSON.parse(r.original_payload_json)
        : null;
      const rawCat =
        payload?.category_id ??
        payload?.categoryId ??
        payload?.category ??
        null;
      if (rawCat == null) continue;
      const catType = r.type === 'movie' ? 'vod' : r.type;
      const categoryId = `${r.source_id}:${catType}:${String(rawCat)}`;
      await db.runAsync(
        `INSERT OR IGNORE INTO content_item_categories (item_id, category_id) VALUES ($item_id, $category_id)`,
        { $item_id: r.id, $category_id: categoryId }
      );
      inserted++;
    } catch {
      // ignore malformed payloads
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[db/ui] backfillMissingItemCategories -> inserted ${inserted}`);
  return inserted;
}
