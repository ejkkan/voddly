import { api, APIError } from 'encore.dev/api';
import { userDB } from '../db';
import { getAuthData } from '~encore/auth';

function uuid() {
  return crypto.randomUUID();
}

async function verifyProfile(profileId: string, userId: string): Promise<boolean> {
  const row = await userDB.queryRow<{ id: string }>`
    SELECT p.id
    FROM profiles p
    JOIN user_subscription a ON p.subscription_id = a.id
    WHERE p.id = ${profileId} AND a.user_id = ${userId}
  `;
  return !!row;
}

export const listPlaylists = api(
  { expose: true, auth: true, method: 'GET', path: '/profiles/:profileId/playlists' },
  async ({ profileId }: { profileId: string }): Promise<{ playlists: { id: string; name: string; created_at: string }[] }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');
    if (!(await verifyProfile(profileId, auth.userID))) throw APIError.permissionDenied('Profile not found or access denied');

    const rows = userDB.query<{ id: string; name: string; created_at: Date }>`
      SELECT id, name, created_at
      FROM profile_playlists
      WHERE profile_id = ${profileId}
      ORDER BY created_at DESC
    `;
    const playlists: { id: string; name: string; created_at: string }[] = [];
    for await (const r of rows) playlists.push({ id: r.id, name: r.name, created_at: r.created_at.toISOString() });
    return { playlists };
  }
);

export const createPlaylist = api(
  { expose: true, auth: true, method: 'POST', path: '/profiles/:profileId/playlists' },
  async ({ profileId, name }: { profileId: string; name: string }): Promise<{ id: string }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');
    if (!name?.trim()) throw APIError.invalidArgument('Name required');
    if (!(await verifyProfile(profileId, auth.userID))) throw APIError.permissionDenied('Profile not found or access denied');

    const id = uuid();
    await userDB.exec`
      INSERT INTO profile_playlists (id, profile_id, name)
      VALUES (${id}, ${profileId}, ${name.trim()})
    `;
    return { id };
  }
);

export const deletePlaylist = api(
  { expose: true, auth: true, method: 'DELETE', path: '/profiles/:profileId/playlists/:playlistId' },
  async ({ profileId, playlistId }: { profileId: string; playlistId: string }): Promise<{ ok: true }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');
    if (!(await verifyProfile(profileId, auth.userID))) throw APIError.permissionDenied('Profile not found or access denied');

    await userDB.exec`
      DELETE FROM profile_playlists
      WHERE id = ${playlistId} AND profile_id = ${profileId}
    `;
    return { ok: true };
  }
);

export const listPlaylistItems = api(
  { expose: true, auth: true, method: 'GET', path: '/profiles/:profileId/playlists/:playlistId/items' },
  async ({ profileId, playlistId }: { profileId: string; playlistId: string }): Promise<{ items: { content_uid: string; sort_order: number; added_at: string }[] }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');
    if (!(await verifyProfile(profileId, auth.userID))) throw APIError.permissionDenied('Profile not found or access denied');

    const rows = userDB.query<{ content_uid: string; sort_order: number; added_at: Date }>`
      SELECT content_uid, sort_order, added_at
      FROM profile_playlist_items
      WHERE playlist_id = ${playlistId}
      ORDER BY sort_order ASC, added_at DESC
    `;
    const items: { content_uid: string; sort_order: number; added_at: string }[] = [];
    for await (const r of rows) items.push({ content_uid: r.content_uid, sort_order: r.sort_order, added_at: r.added_at.toISOString() });
    return { items };
  }
);

export const addPlaylistItem = api(
  { expose: true, auth: true, method: 'POST', path: '/profiles/:profileId/playlists/:playlistId/items' },
  async ({ profileId, playlistId, contentUid, sortOrder = 0 }: { profileId: string; playlistId: string; contentUid: string; sortOrder?: number }): Promise<{ ok: true }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');
    if (!(await verifyProfile(profileId, auth.userID))) throw APIError.permissionDenied('Profile not found or access denied');

    await userDB.exec`
      INSERT INTO profile_playlist_items (playlist_id, content_uid, sort_order, added_at)
      VALUES (${playlistId}, ${contentUid}, ${sortOrder}, CURRENT_TIMESTAMP)
      ON CONFLICT (playlist_id, content_uid) DO UPDATE SET sort_order = EXCLUDED.sort_order
    `;
    return { ok: true };
  }
);

export const removePlaylistItem = api(
  { expose: true, auth: true, method: 'DELETE', path: '/profiles/:profileId/playlists/:playlistId/items/:contentUid' },
  async ({ profileId, playlistId, contentUid }: { profileId: string; playlistId: string; contentUid: string }): Promise<{ ok: true }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');
    if (!(await verifyProfile(profileId, auth.userID))) throw APIError.permissionDenied('Profile not found or access denied');

    await userDB.exec`
      DELETE FROM profile_playlist_items
      WHERE playlist_id = ${playlistId} AND content_uid = ${contentUid}
    `;
    return { ok: true };
  }
);

