import type * as SQLite from 'expo-sqlite';

export type DatabaseHandle = SQLite.SQLiteDatabase;

export async function migrateDbIfNeeded(db: DatabaseHandle) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await createCoreSchema(db);
  await createIndexes(db);
  await createFts(db);
}

async function createCoreSchema(db: DatabaseHandle) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      base_url TEXT,
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

async function createContentItemsTable(db: DatabaseHandle) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS content_items (
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
    CREATE INDEX IF NOT EXISTS idx_categories_source ON categories(source_id, source_category_id);
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
