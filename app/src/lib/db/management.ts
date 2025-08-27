import { openDb } from './index';
import { clearAccountData } from './migrations';

/**
 * Database management utilities for account lifecycle and source synchronization
 */

/**
 * Clear ALL data for a specific account (used for account deletion - use with caution!)
 */
export async function clearAccountCompletely(accountId: string) {
  console.log('[DB-CLEANUP] Starting complete cleanup for account:', accountId);
  const db = await openDb();
  console.log('[DB-CLEANUP] Database opened, calling clearAccountData');
  await clearAccountData(db, accountId);
  console.log('[DB-CLEANUP] Complete cleanup finished for account:', accountId);
}

/**
 * Clear ALL data from the database (used for account isolation - use with caution!)
 * This ensures no data leakage between different users on the same device
 */
export async function clearAllData() {
  console.log('[DB-ISOLATION] 🚨 Clearing ALL data for account isolation');
  const db = await openDb();

  try {
    // Clear all tables
    await db.runAsync('DELETE FROM movies');
    await db.runAsync('DELETE FROM series');
    await db.runAsync('DELETE FROM channels');
    await db.runAsync('DELETE FROM categories');
    await db.runAsync('DELETE FROM sources');
    await db.runAsync('DELETE FROM accounts');

    console.log('[DB-ISOLATION] ✅ All data cleared successfully');
  } catch (error) {
    console.error('[DB-ISOLATION] Failed to clear all data:', error);
    throw error;
  }
}

/**
 * Get all source IDs for an account
 */
export async function getAccountSourceIds(
  accountId: string
): Promise<string[]> {
  const db = await openDb();
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM sources WHERE account_id = $account_id',
    { $account_id: accountId }
  );
  return rows.map((row) => row.id);
}

/**
 * Check if a source exists for an account
 */
export async function sourceExists(
  accountId: string,
  sourceId: string
): Promise<boolean> {
  const db = await openDb();
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM sources WHERE account_id = $account_id AND id = $source_id',
    { $account_id: accountId, $source_id: sourceId }
  );
  return !!row;
}
