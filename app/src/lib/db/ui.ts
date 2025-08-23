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
  limit = 10,
  accountId?: string
): Promise<UiCatalogItem[]> {
  const db = await openDb();
  const rows = await db.getAllAsync(
    `SELECT i.id, i.type, i.title, i.poster_url, i.backdrop_url, i.release_date, i.rating, i.rating_5based,
            ic.category_id
     FROM content_items i
     LEFT JOIN content_item_categories ic ON ic.item_id = i.id
     WHERE i.type = $type ${accountId ? 'AND i.account_id = $account_id' : ''}
     ORDER BY i.added_at DESC, i.title ASC
     LIMIT $limit`,
    accountId
      ? { $type: type, $limit: limit, $account_id: accountId }
      : { $type: type, $limit: limit }
  );
  const items = rows.map(mapRowToUiItem);
  // Debug: inspect what we fetched

  // Debug log removed
  return items;
}

export async function fetchCategoriesWithPreviews(
  type: CatalogItemType,
  limitPerCategory = 20,
  maxCategories = 6,
  categoryOffset = 0,
  accountId?: string
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
  const baseQuery = `SELECT c.id, c.name
     FROM categories c
     WHERE c.type = $catType ${accountId ? 'AND c.account_id = $accountId' : ''} AND c.source_id IN (
       SELECT DISTINCT source_id FROM content_items WHERE type = $itemType ${accountId ? 'AND account_id = $accountId' : ''}
     )
     ORDER BY c.name ASC`;
  const catsParams: Record<string, unknown> = {
    $catType: categoryType,
    $itemType: type,
  };
  if (accountId) (catsParams as any).$accountId = accountId;
  const catsQuery =
    typeof maxCategories === 'number' && maxCategories > 0
      ? `${baseQuery} LIMIT $maxCats OFFSET $catOffset`
      : baseQuery;
  if (typeof maxCategories === 'number' && maxCategories > 0) {
    (catsParams as any).$maxCats = maxCategories;
    (catsParams as any).$catOffset = categoryOffset || 0;
  }
  const cats = (await db.getAllAsync(
    catsQuery,
    catsParams as any
  )) as unknown as {
    id: string;
    name: string;
  }[];
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
       WHERE ic.category_id = $category_id AND i.type = $type ${accountId ? 'AND i.account_id = $account_id' : ''}
       ORDER BY i.added_at DESC, i.title ASC
       LIMIT $limit`,
      accountId
        ? {
            $category_id: c.id,
            $type: type,
            $limit: limitPerCategory,
            $account_id: accountId,
          }
        : { $category_id: c.id, $type: type, $limit: limitPerCategory }
    );
    const items = rows.map(mapRowToUiItem);
    results.push({ categoryId: c.id, name: c.name, items });
  }

  // Debug log removed
  return results;
}

export async function fetchCategoryItems(
  type: CatalogItemType,
  categoryId: string,
  limit = 25,
  offset = 0,
  accountId?: string
): Promise<UiCatalogItem[]> {
  const db = await openDb();
  const rows = await db.getAllAsync(
    `SELECT i.id, i.type, i.title, i.poster_url, i.backdrop_url, i.release_date, i.rating, i.rating_5based,
            ic.category_id
     FROM content_items i
     JOIN content_item_categories ic ON ic.item_id = i.id
     WHERE ic.category_id = $category_id AND i.type = $type ${accountId ? 'AND i.account_id = $account_id' : ''}
     ORDER BY i.added_at DESC, i.title ASC
     LIMIT $limit OFFSET $offset`,
    accountId
      ? {
          $category_id: categoryId,
          $type: type,
          $limit: limit,
          $offset: offset,
          $account_id: accountId,
        }
      : {
          $category_id: categoryId,
          $type: type,
          $limit: limit,
          $offset: offset,
        }
  );
  return rows.map(mapRowToUiItem);
}

export async function fetchDashboardPreviews(
  limit = 10,
  accountId?: string
): Promise<{
  movies: UiCatalogItem[];
  series: UiCatalogItem[];
  live: UiCatalogItem[];
}> {
  const [movies, series, live] = await Promise.all([
    fetchPreviewByType('movie', limit, accountId),
    fetchPreviewByType('series', limit, accountId),
    fetchPreviewByType('live', limit, accountId),
  ]);
  return { movies, series, live };
}

export async function fetchRandomByType(
  type: CatalogItemType,
  limit = 10,
  accountId?: string
): Promise<UiCatalogItem[]> {
  const db = await openDb();
  const rows = await db.getAllAsync(
    `SELECT i.id, i.type, i.title, i.poster_url, i.backdrop_url, i.release_date, i.rating, i.rating_5based,
            ic.category_id
     FROM content_items i
     LEFT JOIN content_item_categories ic ON ic.item_id = i.id
     WHERE i.type = $type ${accountId ? 'AND i.account_id = $account_id' : ''}
     ORDER BY RANDOM()
     LIMIT $limit`,
    accountId
      ? { $type: type, $limit: limit, $account_id: accountId }
      : { $type: type, $limit: limit }
  );
  return rows.map(mapRowToUiItem);
}

/**
 * Backfill removed for runtime performance. If needed, run as a one-off maintenance.
 */
export async function backfillMissingItemCategories(): Promise<number> {
  return 0;
}
