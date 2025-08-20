import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import { migrateDbIfNeeded } from './migrations';

export type DatabaseHandle = SQLite.SQLiteDatabase;

let dbPromise: Promise<DatabaseHandle> | null = null;
let dbHandle: DatabaseHandle | null = null;
let cleanupAttached = false;

async function initDb(): Promise<DatabaseHandle> {
  const db = await SQLite.openDatabaseAsync('catalog.db');
  await migrateDbIfNeeded(db);
  dbHandle = db;
  return db;
}

function attachWebCleanupOnce() {
  if (cleanupAttached || Platform.OS !== 'web') return;
  cleanupAttached = true;
  const close = async () => {
    try {
      if (dbHandle && typeof dbHandle.closeAsync === 'function') {
        await dbHandle.closeAsync();
      }
    } catch {
      // ignore
    } finally {
      dbHandle = null;
      dbPromise = null;
    }
  };
  // pagehide: fires on navigation away (including back/forward), supports bfcache
  window.addEventListener('pagehide', () => {
    // best-effort close to avoid stale worker handles on BFCache restores
    close();
  });
  // freeze: Safari may freeze pages; close proactively
  // @ts-expect-error: not all browsers support freeze
  window.addEventListener('freeze', () => close());
}

export async function openDb(): Promise<DatabaseHandle> {
  if (!dbPromise) {
    attachWebCleanupOnce();
    dbPromise = initDb();
  }
  return dbPromise;
}

export { migrateDbIfNeeded } from './migrations';
