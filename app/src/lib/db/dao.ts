import { openDb } from './index';

export async function searchCatalog(
  q: string,
  type?: 'movie' | 'series' | 'live'
) {
  const db = await openDb();
  const hasFts = await db
    .getFirstAsync<{
      cnt: number;
    }>(
      "SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='item_fts'"
    )
    .then((r) => (r?.cnt ?? 0) > 0);
  let rows: any[] = [];
  if (hasFts) {
    try {
      const whereType = type ? 'AND i.type = $type' : '';
      const paramsFts: Record<string, any> = { $q: q };
      if (type) paramsFts.$type = type;
      rows = await db.getAllAsync(
        `SELECT i.* FROM item_fts f
         JOIN content_items i ON i.id = f.rowid
         WHERE item_fts MATCH $q ${whereType}
         ORDER BY rank LIMIT 200`,
        paramsFts as any
      );
    } catch {
      // FTS is present but MATCH failed (e.g., unsupported on this platform). Fallback to LIKE below.
    }
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    const whereType = type ? 'AND i.type = $type' : '';
    const params: Record<string, any> = { $like: `%${q}%` };
    if (type) params.$type = type;
    rows = await db.getAllAsync(
      `SELECT i.* FROM content_items i
       WHERE (i.title LIKE $like OR i.description LIKE $like) ${whereType}
       ORDER BY i.title LIMIT 200`,
      params as any
    );
  }

  // Post-filter to ignore bracketed tags like [PRE], [2007] when matching
  const normalizedQuery = String(q).toLowerCase();
  const stripBracketed = (s: string) => s.replace(/\[[^\]]*\]/g, '');
  const filtered = rows.filter((item) => {
    const title = stripBracketed(String(item.title ?? '')).toLowerCase();
    const description = stripBracketed(
      String(item.description ?? '')
    ).toLowerCase();
    return (
      title.includes(normalizedQuery) || description.includes(normalizedQuery)
    );
  });
  return filtered;
}

export async function getRecentAdded(
  limit = 50,
  type?: 'movie' | 'series' | 'live'
) {
  const db = await openDb();
  const whereType = type ? 'WHERE type = $type' : '';
  const params: Record<string, any> = { $limit: limit };
  if (type) params.$type = type;
  return db.getAllAsync(
    `SELECT * FROM content_items ${whereType} ORDER BY datetime(added_at) DESC LIMIT $limit`,
    params as any
  );
}
