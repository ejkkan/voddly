import { api, APIError } from 'encore.dev/api';
import { userDB } from '../db';
import { getAuthData } from '~encore/auth';

interface ModifyFavoriteRequest {
  profileId: string;
  contentUid: string;
}

export const addFavorite = api(
  { expose: true, auth: true, method: 'POST', path: '/profiles/:profileId/favorites' },
  async ({ profileId, contentUid }: ModifyFavoriteRequest): Promise<{ ok: true }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const owns = await userDB.queryRow<{ id: string }>`
      SELECT p.id
      FROM profiles p
      JOIN user_subscription a ON p.subscription_id = a.id
      WHERE p.id = ${profileId} AND a.user_id = ${auth.userID}
    `;
    if (!owns) throw APIError.permissionDenied('Profile not found or access denied');

    await userDB.exec`
      INSERT INTO profile_favorites (profile_id, content_uid, added_at)
      VALUES (${profileId}, ${contentUid}, CURRENT_TIMESTAMP)
      ON CONFLICT (profile_id, content_uid) DO NOTHING
    `;

    return { ok: true };
  }
);

export const removeFavorite = api(
  { expose: true, auth: true, method: 'DELETE', path: '/profiles/:profileId/favorites/:contentUid' },
  async ({ profileId, contentUid }: { profileId: string; contentUid: string }): Promise<{ ok: true }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const owns = await userDB.queryRow<{ id: string }>`
      SELECT p.id
      FROM profiles p
      JOIN user_subscription a ON p.subscription_id = a.id
      WHERE p.id = ${profileId} AND a.user_id = ${auth.userID}
    `;
    if (!owns) throw APIError.permissionDenied('Profile not found or access denied');

    await userDB.exec`
      DELETE FROM profile_favorites
      WHERE profile_id = ${profileId} AND content_uid = ${contentUid}
    `;

    return { ok: true };
  }
);

export const listFavorites = api(
  { expose: true, auth: true, method: 'GET', path: '/profiles/:profileId/favorites' },
  async ({ profileId }: { profileId: string }): Promise<{ items: { content_uid: string; added_at: string }[] }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const owns = await userDB.queryRow<{ id: string }>`
      SELECT p.id
      FROM profiles p
      JOIN user_subscription a ON p.subscription_id = a.id
      WHERE p.id = ${profileId} AND a.user_id = ${auth.userID}
    `;
    if (!owns) throw APIError.permissionDenied('Profile not found or access denied');

    const rows = userDB.query<{ content_uid: string; added_at: Date }>`
      SELECT content_uid, added_at
      FROM profile_favorites
      WHERE profile_id = ${profileId}
      ORDER BY added_at DESC
    `;

    const items: { content_uid: string; added_at: string }[] = [];
    for await (const r of rows) {
      items.push({ content_uid: r.content_uid, added_at: r.added_at.toISOString() });
    }
    return { items };
  }
);

