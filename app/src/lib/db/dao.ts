import { openDb } from './index';

export async function searchCatalog(
  q: string,
  type?: 'movie' | 'series' | 'live'
) {
  const db = await openDb();
  const hasFts = await db
    .getFirstAsync<{
      cnt: number;
    }>('SELECT count(*) as cnt FROM sqlite_master WHERE type="table" AND name="item_fts"')
    .then((r) => (r?.cnt ?? 0) > 0);
  if (hasFts) {
    const whereType = type ? 'AND i.type = $type' : '';
    return db.getAllAsync(
      `SELECT i.* FROM item_fts f
       JOIN content_items i ON i.id = f.rowid
       WHERE item_fts MATCH $q ${whereType}
       ORDER BY rank LIMIT 200`,
      { $q: q, ...(type ? { $type: type } : {}) }
    );
  }
  const whereType = type ? 'AND type = $type' : '';
  return db.getAllAsync(
    `SELECT * FROM content_items
     WHERE (title LIKE $like OR description LIKE $like) ${whereType}
     ORDER BY title LIMIT 200`,
    { $like: `%${q}%`, ...(type ? { $type: type } : {}) }
  );
}

export async function getRecentAdded(
  limit = 50,
  type?: 'movie' | 'series' | 'live'
) {
  const db = await openDb();
  const whereType = type ? 'WHERE type = $type' : '';
  return db.getAllAsync(
    `SELECT * FROM content_items ${whereType} ORDER BY datetime(added_at) DESC LIMIT $limit`,
    { $type: type, $limit: limit }
  );
}
