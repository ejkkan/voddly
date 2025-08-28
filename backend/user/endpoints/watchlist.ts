import { api, APIError } from 'encore.dev/api';
import { userDB } from '../db';
import { getAuthData } from '~encore/auth';

interface ModifyWatchlistRequest {
  profileId: string;
  contentUid: string;
  sortOrder?: number;
}

export const addToWatchlist = api(
  { expose: true, auth: true, method: 'POST', path: '/profiles/:profileId/watchlist' },
  async ({ profileId, contentUid, sortOrder = 0 }: ModifyWatchlistRequest): Promise<{ ok: true }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const owns = await userDB.queryRow<{ id: string }>`
      SELECT p.id
      FROM profiles p
      JOIN accounts a ON p.account_id = a.id
      WHERE p.id = ${profileId} AND a.user_id = ${auth.userID}
    `;
    if (!owns) throw APIError.permissionDenied('Profile not found or access denied');

    await userDB.exec`
      INSERT INTO profile_watchlist (profile_id, content_uid, sort_order, added_at)
      VALUES (${profileId}, ${contentUid}, ${sortOrder}, CURRENT_TIMESTAMP)
      ON CONFLICT (profile_id, content_uid)
      DO UPDATE SET sort_order = EXCLUDED.sort_order, added_at = profile_watchlist.added_at
    `;

    return { ok: true };
  }
);

export const removeFromWatchlist = api(
  { expose: true, auth: true, method: 'DELETE', path: '/profiles/:profileId/watchlist/:contentUid' },
  async ({ profileId, contentUid }: { profileId: string; contentUid: string }): Promise<{ ok: true }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const owns = await userDB.queryRow<{ id: string }>`
      SELECT p.id
      FROM profiles p
      JOIN accounts a ON p.account_id = a.id
      WHERE p.id = ${profileId} AND a.user_id = ${auth.userID}
    `;
    if (!owns) throw APIError.permissionDenied('Profile not found or access denied');

    await userDB.exec`
      DELETE FROM profile_watchlist
      WHERE profile_id = ${profileId} AND content_uid = ${contentUid}
    `;

    return { ok: true };
  }
);

export const listWatchlist = api(
  { expose: true, auth: true, method: 'GET', path: '/profiles/:profileId/watchlist' },
  async ({ profileId }: { profileId: string }): Promise<{ items: { content_uid: string; sort_order: number; added_at: string }[] }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const owns = await userDB.queryRow<{ id: string }>`
      SELECT p.id
      FROM profiles p
      JOIN accounts a ON p.account_id = a.id
      WHERE p.id = ${profileId} AND a.user_id = ${auth.userID}
    `;
    if (!owns) throw APIError.permissionDenied('Profile not found or access denied');

    const rows = userDB.query<{ content_uid: string; sort_order: number; added_at: Date }>`
      SELECT content_uid, sort_order, added_at
      FROM profile_watchlist
      WHERE profile_id = ${profileId}
      ORDER BY sort_order ASC, added_at DESC
    `;

    const items: { content_uid: string; sort_order: number; added_at: string }[] = [];
    for await (const r of rows) {
      items.push({ content_uid: r.content_uid, sort_order: r.sort_order, added_at: r.added_at.toISOString() });
    }
    return { items };
  }
);

