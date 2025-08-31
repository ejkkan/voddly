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
  async ({ profileId }: { profileId: string }): Promise<{ 
    playlists: { 
      id: string; 
      name: string; 
      created_at: string;
      items: string[];
    }[] 
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');
    if (!(await verifyProfile(profileId, auth.userID))) throw APIError.permissionDenied('Profile not found or access denied');

    const rows = userDB.query<{ id: string; name: string; created_at: Date }>`
      SELECT id, name, created_at
      FROM profile_playlists
      WHERE profile_id = ${profileId}
      ORDER BY created_at DESC
    `;
    
    const playlists: { id: string; name: string; created_at: string; items: string[] }[] = [];
    
    for await (const r of rows) {
      const itemRows = userDB.query<{ content_id: string }>`
        SELECT content_id
        FROM playlist_items
        WHERE playlist_id = ${r.id}
        ORDER BY position ASC
      `;
      
      const items: string[] = [];
      for await (const item of itemRows) {
        items.push(item.content_id);
      }
      
      playlists.push({ 
        id: r.id, 
        name: r.name, 
        created_at: r.created_at.toISOString(),
        items 
      });
    }
    
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
  async ({ profileId, playlistId }: { profileId: string; playlistId: string }): Promise<{ items: { content_id: string; sort_order: number; added_at: string }[] }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');
    if (!(await verifyProfile(profileId, auth.userID))) throw APIError.permissionDenied('Profile not found or access denied');

    const rows = userDB.query<{ content_id: string; position: number; added_at: Date }>`
      SELECT content_id, position, added_at
      FROM playlist_items
      WHERE playlist_id = ${playlistId}
      ORDER BY position ASC, added_at DESC
    `;
    const items: { content_id: string; sort_order: number; added_at: string }[] = [];
    for await (const r of rows) items.push({ content_id: r.content_id, sort_order: r.position, added_at: r.added_at.toISOString() });
    return { items };
  }
);

export const addPlaylistItem = api(
  { expose: true, auth: true, method: 'POST', path: '/profiles/:profileId/playlists/:playlistId/items' },
  async ({ profileId, playlistId, contentId }: { profileId: string; playlistId: string; contentId: string }): Promise<{ ok: true }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');
    if (!(await verifyProfile(profileId, auth.userID))) throw APIError.permissionDenied('Profile not found or access denied');

    // Extract content type from contentId format: {sourceId}:{contentType}:{sourceItemId}
    const contentIdParts = contentId.split(':');
    if (contentIdParts.length !== 3) {
      throw APIError.invalidArgument('Invalid content ID format. Expected: {sourceId}:{contentType}:{sourceItemId}');
    }
    
    const contentType = contentIdParts[1];
    if (!['movie', 'episode', 'series', 'live'].includes(contentType)) {
      throw APIError.invalidArgument(`Invalid content type: ${contentType}. Must be one of: movie, episode, series, live`);
    }

    const existing = await userDB.queryRow<{ id: string }>`
      SELECT id FROM playlist_items
      WHERE playlist_id = ${playlistId} AND content_id = ${contentId}
    `;
    
    if (existing) {
      return { ok: true };
    }

    const maxPos = await userDB.queryRow<{ max_position: number | null }>`
      SELECT MAX(position) as max_position FROM playlist_items WHERE playlist_id = ${playlistId}
    `;
    const nextPosition = (maxPos?.max_position ?? -1) + 1;

    await userDB.exec`
      INSERT INTO playlist_items (playlist_id, content_id, content_type, position, added_at)
      VALUES (${playlistId}, ${contentId}, ${contentType}, ${nextPosition}, CURRENT_TIMESTAMP)
    `;
    return { ok: true };
  }
);

export const removePlaylistItem = api(
  { expose: true, auth: true, method: 'DELETE', path: '/profiles/:profileId/playlists/:playlistId/items/:contentId' },
  async ({ profileId, playlistId, contentId }: { profileId: string; playlistId: string; contentId: string }): Promise<{ ok: true }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');
    if (!(await verifyProfile(profileId, auth.userID))) throw APIError.permissionDenied('Profile not found or access denied');

    await userDB.exec`
      DELETE FROM playlist_items
      WHERE playlist_id = ${playlistId} AND content_id = ${contentId}
    `;
    return { ok: true };
  }
);

