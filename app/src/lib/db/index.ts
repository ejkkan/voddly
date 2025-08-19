import * as SQLite from 'expo-sqlite';

import { migrateDbIfNeeded } from './migrations';

export type DatabaseHandle = SQLite.SQLiteDatabase;

let dbPromise: Promise<DatabaseHandle> | null = null;

export async function openDb(): Promise<DatabaseHandle> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('catalog.db');
      await migrateDbIfNeeded(db);
      return db;
    })();
  }
  return dbPromise;
}

export { migrateDbIfNeeded } from './migrations';
