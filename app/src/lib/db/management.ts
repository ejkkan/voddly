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
    // Check if any tables exist at all
    const tableCount = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'"
    );

    if (!tableCount || tableCount.count === 0) {
      console.log(
        '[DB-ISOLATION] ℹ️ No tables exist yet (first time setup), nothing to clear'
      );
      return; // Exit gracefully - nothing to clear
    }

    // Check if tables exist before trying to clear them
    const tables = [
      'content_item_categories',
      'movies_ext',
      'series_ext',
      'episodes_ext',
      'live_ext',
      'content_items',
      'categories',
      'sources',
    ];

    let clearedCount = 0;
    for (const table of tables) {
      try {
        // Check if table exists
        const tableExists = await db.getFirstAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          [table]
        );

        if (tableExists) {
          await db.runAsync(`DELETE FROM ${table}`);
          clearedCount++;
          console.log(`[DB-ISOLATION] ✅ Cleared table: ${table}`);
        }
      } catch (tableError) {
        console.log(`[DB-ISOLATION] ⚠️ Error with table ${table}:`, tableError);
        // Continue with other tables
      }
    }

    if (clearedCount > 0) {
      console.log(
        `[DB-ISOLATION] ✅ Cleared ${clearedCount} tables successfully`
      );
    } else {
      console.log('[DB-ISOLATION] ℹ️ No existing tables to clear');
    }
  } catch (error) {
    console.log(
      '[DB-ISOLATION] ℹ️ Database not ready yet (first time setup), nothing to clear'
    );
    // Don't throw error - this is expected for first-time users
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
