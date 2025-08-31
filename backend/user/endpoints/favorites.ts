import { api, APIError } from 'encore.dev/api';
import { userDB } from '../db';
import { getAuthData } from '~encore/auth';

interface ModifyFavoriteRequest {
  profileId: string;
  contentId: string;
  contentType: 'movie' | 'series' | 'tv' | 'category' | 'channel';
}

export const addFavorite = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/profiles/:profileId/favorites',
  },
  async ({
    profileId,
    contentId,
    contentType,
  }: ModifyFavoriteRequest): Promise<{ ok: true }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const owns = await userDB.queryRow<{ id: string }>`
      SELECT p.id
      FROM profiles p
      JOIN user_subscription a ON p.subscription_id = a.id
      WHERE p.id = ${profileId} AND a.user_id = ${auth.userID}
    `;
    if (!owns)
      throw APIError.permissionDenied('Profile not found or access denied');

    if (!['movie', 'series', 'tv', 'category', 'channel'].includes(contentType)) {
      throw APIError.invalidArgument('Invalid content type');
    }

    await userDB.exec`
      INSERT INTO profile_favorites (profile_id, content_id, content_type, added_at)
      VALUES (${profileId}, ${contentId}, ${contentType}, CURRENT_TIMESTAMP)
      ON CONFLICT (profile_id, content_id) DO UPDATE SET content_type = EXCLUDED.content_type
    `;

    return { ok: true };
  }
);

export const removeFavorite = api(
  {
    expose: true,
    auth: true,
    method: 'DELETE',
    path: '/profiles/:profileId/favorites/:contentId',
  },
  async ({
    profileId,
    contentId,
  }: {
    profileId: string;
    contentId: string;
  }): Promise<{ ok: true }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const owns = await userDB.queryRow<{ id: string }>`
      SELECT p.id
      FROM profiles p
      JOIN user_subscription a ON p.subscription_id = a.id
      WHERE p.id = ${profileId} AND a.user_id = ${auth.userID}
    `;
    if (!owns)
      throw APIError.permissionDenied('Profile not found or access denied');

    await userDB.exec`
      DELETE FROM profile_favorites
      WHERE profile_id = ${profileId} AND content_id = ${contentId}
    `;

    return { ok: true };
  }
);

export const listFavorites = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/profiles/:profileId/favorites',
  },
  async ({
    profileId,
    contentType,
  }: {
    profileId: string;
    contentType?: 'movie' | 'series' | 'tv' | 'category' | 'channel';
  }): Promise<{
    items: {
      content_id: string;
      content_type: 'movie' | 'series' | 'tv' | 'category' | 'channel' | null;
      added_at: string;
    }[];
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const owns = await userDB.queryRow<{ id: string }>`
      SELECT p.id
      FROM profiles p
      JOIN user_subscription a ON p.subscription_id = a.id
      WHERE p.id = ${profileId} AND a.user_id = ${auth.userID}
    `;
    if (!owns)
      throw APIError.permissionDenied('Profile not found or access denied');

    let rows;
    if (contentType) {
      rows = await userDB.query<{
        content_id: string;
        content_type: 'movie' | 'series' | 'tv' | 'category' | 'channel' | null;
        added_at: Date;
      }>`
        SELECT content_id, content_type, added_at
        FROM profile_favorites
        WHERE profile_id = ${profileId} AND content_type = ${contentType}
        ORDER BY added_at DESC
      `;
    } else {
      rows = await userDB.query<{
        content_id: string;
        content_type: 'movie' | 'series' | 'tv' | 'category' | 'channel' | null;
        added_at: Date;
      }>`
        SELECT content_id, content_type, added_at
        FROM profile_favorites
        WHERE profile_id = ${profileId}
        ORDER BY added_at DESC
      `;
    }

    const items: {
      content_id: string;
      content_type: 'movie' | 'series' | 'tv' | 'category' | 'channel' | null;
      added_at: string;
    }[] = [];
    for await (const r of rows) {
      items.push({
        content_id: r.content_id,
        content_type: r.content_type ?? null,
        added_at: r.added_at.toISOString(),
      });
    }
    return { items };
  }
);
