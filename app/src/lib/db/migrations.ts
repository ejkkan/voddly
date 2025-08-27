import { type DatabaseHandle } from 'expo-sqlite';

export async function migrateDbIfNeeded(db: DatabaseHandle) {
  // Enable foreign keys first; broadly supported across platforms
  await db.execAsync('PRAGMA foreign_keys = ON;');
  // Attempt to enable WAL; this can fail on some web/wasm environments. Ignore failures.
  try {
    await db.execAsync('PRAGMA journal_mode = WAL;');
  } catch {}
  await createCoreSchema(db);
  await ensureExtraColumns(db);
  await createIndexes(db);
  await createFts(db);
}

// Danger: wipes all data. Keeps schema intact and re-applies FKs/indices
export async function resetDatabase(db: DatabaseHandle) {
  await db.execAsync('PRAGMA foreign_keys = ON; BEGIN');
  try {
    await db.execAsync(`
      DELETE FROM content_item_categories;
      DELETE FROM movies_ext;
      DELETE FROM series_ext;
      DELETE FROM episodes_ext;
      DELETE FROM live_ext;
      DELETE FROM content_items;
      DELETE FROM categories;
      DELETE FROM sources;
    `);
    await db.execAsync('COMMIT');
    // Reclaim space
    await db.execAsync('VACUUM');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

// Clear all data for a specific account (for account deletion - use with caution!)
export async function clearAccountData(db: DatabaseHandle, accountId: string) {
  console.log(
    `[DB-CLEAR] 🚨 clearAccountData called! accountId: ${accountId}, timestamp: ${new Date().toISOString()}, stack: ${new Error().stack}`
  );

  await db.execAsync('PRAGMA foreign_keys = ON; BEGIN');
  try {
    await db.execAsync(
      `
        DELETE FROM content_item_categories WHERE item_id IN (
          SELECT id FROM content_items WHERE account_id = $account_id
        );
        DELETE FROM movies_ext WHERE item_id IN (
          SELECT id FROM content_items WHERE account_id = $account_id
        );
        DELETE FROM series_ext WHERE series_item_id IN (
          SELECT id FROM content_items WHERE account_id = $account_id
        );
        DELETE FROM episodes_ext WHERE series_item_id IN (
          SELECT id FROM content_items WHERE account_id = $account_id
        );
        DELETE FROM live_ext WHERE item_id IN (
          SELECT id FROM content_items WHERE account_id = $account_id
        );
        DELETE FROM content_items WHERE account_id = $account_id;
        DELETE FROM categories WHERE account_id = $account_id;
        DELETE FROM sources WHERE account_id = $account_id;
      `,
      { $account_id: accountId }
    );
    await db.execAsync('COMMIT');
    // Reclaim space
    await db.execAsync('VACUUM');

    console.log(
      `[DB-CLEAR] ✅ Database cleared successfully for account: ${accountId}`
    );
  } catch (e) {
    await db.execAsync('ROLLBACK');
    console.error(`[DB-CLEAR] ❌ Error clearing database: ${e}`);
    throw e;
  }
}

async function createCoreSchema(db: DatabaseHandle) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sources (
      account_id TEXT,
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  await createCategoriesTable(db);
  await createContentItemsTable(db);
  await createItemCategoryTable(db);
  await createMoviesTable(db);
  await createSeriesTable(db);
  await createEpisodesTable(db);
  await createLiveTable(db);
}

async function createCategoriesTable(db: DatabaseHandle) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      account_id TEXT,
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      source_category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      parent_id TEXT REFERENCES categories(id),
      UNIQUE (source_id, source_category_id)
    );
  `);
}

async function ensureExtraColumns(db: DatabaseHandle) {
  // Helper to conditionally add columns if they don't exist
  const hasColumn = async (table: string, column: string): Promise<boolean> => {
    const rows = await db.getAllAsync<{ name: string }>(
      `PRAGMA table_info(${table})`
    );
    return (rows || []).some((r) => String(r.name) === column);
  };

  // sources: account_id
  if (!(await hasColumn('sources', 'account_id'))) {
    await db.execAsync(`ALTER TABLE sources ADD COLUMN account_id TEXT`);
  }

  // sources: remove base_url column (security: no plaintext URLs in DB)
  if (await hasColumn('sources', 'base_url')) {
    await db.execAsync(`ALTER TABLE sources DROP COLUMN base_url`);
  }

  // categories: account_id
  if (!(await hasColumn('categories', 'account_id'))) {
    await db.execAsync(`ALTER TABLE categories ADD COLUMN account_id TEXT`);
  }

  // content_items: tmdb_id for cross-type linking
  if (!(await hasColumn('content_items', 'tmdb_id'))) {
    await db.execAsync(`ALTER TABLE content_items ADD COLUMN tmdb_id TEXT`);
  }
  // content_items: account_id for scoping
  if (!(await hasColumn('content_items', 'account_id'))) {
    await db.execAsync(`ALTER TABLE content_items ADD COLUMN account_id TEXT`);
  }

  // movies_ext: tech and bitrate info
  if (!(await hasColumn('movies_ext', 'bitrate'))) {
    await db.execAsync(`ALTER TABLE movies_ext ADD COLUMN bitrate INTEGER`);
  }
  if (!(await hasColumn('movies_ext', 'video_codec'))) {
    await db.execAsync(`ALTER TABLE movies_ext ADD COLUMN video_codec TEXT`);
  }
  if (!(await hasColumn('movies_ext', 'audio_codec'))) {
    await db.execAsync(`ALTER TABLE movies_ext ADD COLUMN audio_codec TEXT`);
  }
  if (!(await hasColumn('movies_ext', 'width'))) {
    await db.execAsync(`ALTER TABLE movies_ext ADD COLUMN width INTEGER`);
  }
  if (!(await hasColumn('movies_ext', 'height'))) {
    await db.execAsync(`ALTER TABLE movies_ext ADD COLUMN height INTEGER`);
  }
  if (!(await hasColumn('movies_ext', 'tech_json'))) {
    await db.execAsync(`ALTER TABLE movies_ext ADD COLUMN tech_json TEXT`);
  }

  // episodes_ext: ensure container_extension exists
  if (!(await hasColumn('episodes_ext', 'container_extension'))) {
    try {
      await db.execAsync(
        `ALTER TABLE episodes_ext ADD COLUMN container_extension TEXT`
      );
    } catch {}
  }
}

async function createContentItemsTable(db: DatabaseHandle) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS content_items (
      account_id TEXT,
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      source_item_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      sort_title TEXT,
      description TEXT,
      poster_url TEXT,
      backdrop_url TEXT,
      release_date TEXT,
      rating REAL,
      rating_5based REAL,
      is_adult INTEGER,
      added_at TEXT,
      last_modified TEXT,
      popularity REAL,
      original_payload_json TEXT NOT NULL,
      UNIQUE (source_id, source_item_id, type)
    );
  `);
}

async function createItemCategoryTable(db: DatabaseHandle) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS content_item_categories (
      item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      PRIMARY KEY (item_id, category_id)
    );
  `);
}

async function createMoviesTable(db: DatabaseHandle) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS movies_ext (
      item_id TEXT PRIMARY KEY REFERENCES content_items(id) ON DELETE CASCADE,
      stream_id TEXT,
      runtime_minutes INTEGER,
      container_extension TEXT,
      trailer TEXT
    );
  `);
}

async function createSeriesTable(db: DatabaseHandle) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS series_ext (
      item_id TEXT PRIMARY KEY REFERENCES content_items(id) ON DELETE CASCADE,
      tmdb_id TEXT,
      episode_run_time INTEGER
    );
  `);
}

async function createEpisodesTable(db: DatabaseHandle) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS episodes_ext (
      id TEXT PRIMARY KEY,
      series_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
      season_number INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      title TEXT,
      description TEXT,
      air_date TEXT,
      stream_id TEXT,
      container_extension TEXT,
      last_modified TEXT,
      original_payload_json TEXT NOT NULL,
      UNIQUE (series_item_id, season_number, episode_number)
    );
  `);
}

async function createLiveTable(db: DatabaseHandle) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS live_ext (
      item_id TEXT PRIMARY KEY REFERENCES content_items(id) ON DELETE CASCADE,
      channel_number INTEGER,
      epg_channel_id TEXT,
      tv_archive INTEGER,
      tv_archive_duration INTEGER
    );
  `);
}

async function createIndexes(db: DatabaseHandle) {
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_items_type_title ON content_items(type, title);
    CREATE INDEX IF NOT EXISTS idx_items_source ON content_items(source_id);
    CREATE INDEX IF NOT EXISTS idx_items_source_key ON content_items(source_id, source_item_id);
    CREATE INDEX IF NOT EXISTS idx_items_account_source_type ON content_items(account_id, source_id, type);
    CREATE INDEX IF NOT EXISTS idx_items_type_added_at ON content_items(type, added_at DESC);
    CREATE INDEX IF NOT EXISTS idx_items_account_type_added_at ON content_items(account_id, type, added_at DESC);
    CREATE INDEX IF NOT EXISTS idx_categories_source ON categories(source_id, source_category_id);
    CREATE INDEX IF NOT EXISTS idx_categories_account_source ON categories(account_id, source_id, source_category_id);
    CREATE INDEX IF NOT EXISTS idx_sources_account ON sources(account_id, id);
    CREATE INDEX IF NOT EXISTS idx_item_categories_cat ON content_item_categories(category_id);
  `);
}

async function createFts(db: DatabaseHandle) {
  try {
    await db.execAsync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS item_fts USING fts5(
        title, description, cast, director, genres, category_names,
        tokenize = 'unicode61 remove_diacritics 1',
        prefix = '2 3'
      );
    `);
  } catch {
    // FTS disabled (e.g., misconfigured web). We will fallback to LIKE queries.
  }
}
