import { openDb } from './index';

export async function purgeOtherAccounts(currentAccountId?: string) {
  const db = await openDb();
  await db.execAsync('PRAGMA foreign_keys = ON; BEGIN');
  try {
    if (!currentAccountId) {
      await db.execAsync(`
        DELETE FROM content_item_categories
        WHERE item_id IN (
          SELECT id FROM content_items WHERE account_id IS NOT NULL
        )
        OR category_id IN (
          SELECT id FROM categories WHERE account_id IS NOT NULL
        );

        DELETE FROM movies_ext WHERE item_id IN (
          SELECT id FROM content_items WHERE account_id IS NOT NULL
        );
        DELETE FROM series_ext WHERE item_id IN (
          SELECT id FROM content_items WHERE account_id IS NOT NULL
        );
        DELETE FROM episodes_ext WHERE series_item_id IN (
          SELECT id FROM content_items WHERE account_id IS NOT NULL
        );
        DELETE FROM live_ext WHERE item_id IN (
          SELECT id FROM content_items WHERE account_id IS NOT NULL
        );

        DELETE FROM content_items WHERE account_id IS NOT NULL;
        DELETE FROM categories WHERE account_id IS NOT NULL;
        DELETE FROM sources WHERE account_id IS NOT NULL;
      `);
    } else {
      await db.execAsync(
        `
        DELETE FROM content_item_categories
        WHERE item_id IN (
          SELECT id FROM content_items WHERE account_id IS NOT NULL AND account_id != $account_id
        )
        OR category_id IN (
          SELECT id FROM categories WHERE account_id IS NOT NULL AND account_id != $account_id
        );

        DELETE FROM movies_ext WHERE item_id IN (
          SELECT id FROM content_items WHERE account_id IS NOT NULL AND account_id != $account_id
        );
        DELETE FROM series_ext WHERE item_id IN (
          SELECT id FROM content_items WHERE account_id IS NOT NULL AND account_id != $account_id
        );
        DELETE FROM episodes_ext WHERE series_item_id IN (
          SELECT id FROM content_items WHERE account_id IS NOT NULL AND account_id != $account_id
        );
        DELETE FROM live_ext WHERE item_id IN (
          SELECT id FROM content_items WHERE account_id IS NOT NULL AND account_id != $account_id
        );

        DELETE FROM content_items WHERE account_id IS NOT NULL AND account_id != $account_id;
        DELETE FROM categories WHERE account_id IS NOT NULL AND account_id != $account_id;
        DELETE FROM sources WHERE account_id IS NOT NULL AND account_id != $account_id;
      `,
        { $account_id: currentAccountId }
      );
    }
    await db.execAsync('COMMIT');
    await db.execAsync('VACUUM');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}
