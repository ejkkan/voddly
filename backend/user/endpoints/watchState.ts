import { api, APIError } from 'encore.dev/api';
import { userDB } from '../db';
import { getAuthData } from '~encore/auth';

interface UpdateWatchStateRequest {
  profileId: string;
  sourceId?: string; // Optional for backward compatibility
  contentId: string;
  contentType?: string;
  lastPositionSeconds?: number | null;
  totalDurationSeconds?: number | null;
  isFavorite?: boolean | null;
}

interface GetWatchStateResponse {
  states: Array<{
    content_id: string;
    content_type: string | null;
    last_position_seconds: number | null;
    total_duration_seconds: number | null;
    is_favorite: boolean;
    last_watched_at: string;
  }>;
}

// Helper function to verify profile belongs to user
async function verifyProfileAccess(
  profileId: string,
  userId: string
): Promise<boolean> {
  const profile = await userDB.queryRow<{ id: string }>`
    SELECT p.id
    FROM profiles p
    JOIN user_subscription a ON p.subscription_id = a.id
    WHERE p.id = ${profileId} AND a.user_id = ${userId}
  `;
  return !!profile;
}

// Update watch state for a piece of content
export const updateWatchState = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/watch-state',
  },
  async ({
    profileId,
    sourceId,
    contentId,
    contentType,
    lastPositionSeconds,
    totalDurationSeconds,
    isFavorite,
  }: UpdateWatchStateRequest): Promise<{ ok: true }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    if (!profileId || !contentId) {
      throw APIError.invalidArgument('profileId and contentId are required');
    }

    // Verify profile belongs to user
    const hasAccess = await verifyProfileAccess(profileId, auth.userID);
    if (!hasAccess) {
      throw APIError.permissionDenied('Profile not found or access denied');
    }

    await userDB.exec`
      INSERT INTO profile_watch_state (
        profile_id, source_id, content_id, content_type,
        last_position_seconds, total_duration_seconds, 
        is_favorite, last_watched_at
      ) VALUES (
        ${profileId}, ${sourceId || null}, ${contentId}, ${contentType || null},
        ${lastPositionSeconds ?? null}, ${totalDurationSeconds ?? null},
        ${isFavorite ?? false}, CURRENT_TIMESTAMP
      )
      ON CONFLICT (profile_id, content_id)
      DO UPDATE SET 
        source_id = COALESCE(EXCLUDED.source_id, profile_watch_state.source_id),
        content_type = COALESCE(EXCLUDED.content_type, profile_watch_state.content_type),
        last_position_seconds = COALESCE(EXCLUDED.last_position_seconds, profile_watch_state.last_position_seconds),
        total_duration_seconds = COALESCE(EXCLUDED.total_duration_seconds, profile_watch_state.total_duration_seconds),
        is_favorite = COALESCE(EXCLUDED.is_favorite, profile_watch_state.is_favorite),
        last_watched_at = CURRENT_TIMESTAMP
    `;

    return { ok: true };
  }
);

// Get watch state for a profile
export const getWatchState = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/profiles/:profileId/watch-state',
  },
  async ({
    profileId,
  }: {
    profileId: string;
  }): Promise<GetWatchStateResponse> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Verify profile belongs to user
    const hasAccess = await verifyProfileAccess(profileId, auth.userID);
    if (!hasAccess) {
      throw APIError.permissionDenied('Profile not found or access denied');
    }

    const rows = userDB.query<{
      content_id: string;
      content_type: string | null;
      last_position_seconds: number | null;
      total_duration_seconds: number | null;
      is_favorite: boolean;
      last_watched_at: Date;
    }>`
      SELECT 
        content_id, 
        content_type, 
        last_position_seconds, 
        total_duration_seconds, 
        is_favorite, 
        last_watched_at
      FROM profile_watch_state
      WHERE profile_id = ${profileId}
      ORDER BY last_watched_at DESC
    `;

    const states = [];
    for await (const row of rows) {
      states.push({
        ...row,
        last_watched_at: row.last_watched_at.toISOString(),
      });
    }

    return { states };
  }
);

// Get watch state for a specific content item
export const getContentWatchState = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/profiles/:profileId/watch-state/:contentId',
  },
  async ({
    profileId,
    contentId,
  }: {
    profileId: string;
    contentId: string;
  }): Promise<{
    state: {
      content_id: string;
      content_type: string | null;
      last_position_seconds: number | null;
      total_duration_seconds: number | null;
      is_favorite: boolean;
      last_watched_at: string;
    } | null;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Verify profile belongs to user
    const hasAccess = await verifyProfileAccess(profileId, auth.userID);
    if (!hasAccess) {
      throw APIError.permissionDenied('Profile not found or access denied');
    }

    const state = await userDB.queryRow<{
      content_id: string;
      content_type: string | null;
      last_position_seconds: number | null;
      total_duration_seconds: number | null;
      is_favorite: boolean;
      last_watched_at: Date;
    }>`
      SELECT 
        content_id, 
        content_type, 
        last_position_seconds, 
        total_duration_seconds, 
        is_favorite, 
        last_watched_at
      FROM profile_watch_state
      WHERE profile_id = ${profileId} AND content_id = ${contentId}
    `;

    if (!state) {
      return { state: null };
    }

    return {
      state: {
        ...state,
        last_watched_at: state.last_watched_at.toISOString(),
      },
    };
  }
);

// Delete watch state for content
export const deleteWatchState = api(
  {
    expose: true,
    auth: true,
    method: 'DELETE',
    path: '/profiles/:profileId/watch-state/:contentId',
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

    // Verify profile belongs to user
    const hasAccess = await verifyProfileAccess(profileId, auth.userID);
    if (!hasAccess) {
      throw APIError.permissionDenied('Profile not found or access denied');
    }

    await userDB.exec`
      DELETE FROM profile_watch_state
      WHERE profile_id = ${profileId} AND content_id = ${contentId}
    `;

    return { ok: true };
  }
);

// Clear all watch history for a profile
export const clearWatchHistory = api(
  {
    expose: true,
    auth: true,
    method: 'DELETE',
    path: '/profiles/:profileId/watch-state',
  },
  async ({ profileId }: { profileId: string }): Promise<{ ok: true }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Verify profile belongs to user
    const hasAccess = await verifyProfileAccess(profileId, auth.userID);
    if (!hasAccess) {
      throw APIError.permissionDenied('Profile not found or access denied');
    }

    await userDB.exec`
      DELETE FROM profile_watch_state
      WHERE profile_id = ${profileId}
    `;

    return { ok: true };
  }
);

// Get watch state by canonical content UID
export const getWatchStateByUid = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/profiles/:profileId/watch-state/by-uid/:contentUid',
  },
  async ({
    profileId,
    contentUid,
  }: {
    profileId: string;
    contentUid: string;
  }): Promise<{
    state: {
      content_uid: string;
      last_position_seconds: number;
      total_duration_seconds: number | null;
      completed: boolean;
      completed_at: string | null;
      last_watched_at: string | null;
    } | null;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const hasAccess = await verifyProfileAccess(profileId, auth.userID);
    if (!hasAccess) {
      throw APIError.permissionDenied('Profile not found or access denied');
    }

    const row = await userDB.queryRow<{
      content_uid: string;
      last_position_seconds: number;
      total_duration_seconds: number | null;
      completed: boolean;
      completed_at: Date | null;
      last_watched_at: Date | null;
    }>`
      SELECT content_uid, last_position_seconds, total_duration_seconds, completed, completed_at, last_watched_at
      FROM profile_watch_state
      WHERE profile_id = ${profileId} AND content_uid = ${contentUid}
    `;

    if (!row) return { state: null };

    return {
      state: {
        content_uid: row.content_uid,
        last_position_seconds: row.last_position_seconds,
        total_duration_seconds: row.total_duration_seconds,
        completed: !!row.completed,
        completed_at: row.completed_at ? row.completed_at.toISOString() : null,
        last_watched_at: row.last_watched_at ? row.last_watched_at.toISOString() : null,
      },
    };
  }
);

// Convenience: get watch state by TMDB movie id
export const getMovieWatchStateByTmdb = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/profiles/:profileId/watch-state/movie/:tmdbId',
  },
  async ({
    profileId,
    tmdbId,
  }: {
    profileId: string;
    tmdbId: string;
  }): Promise<{ state: { content_uid: string; last_position_seconds: number; total_duration_seconds: number | null; completed: boolean; completed_at: string | null; last_watched_at: string | null } | null }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const hasAccess = await verifyProfileAccess(profileId, auth.userID);
    if (!hasAccess) {
      throw APIError.permissionDenied('Profile not found or access denied');
    }

    const uid = `tmdb:movie:${tmdbId}`;
    const res = await getWatchStateByUid({ profileId, contentUid: uid });
    return res;
  }
);

// Convenience: get watch state by TMDB episode identifiers
export const getEpisodeWatchStateByTmdb = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/profiles/:profileId/watch-state/episode/:parentTmdbId/:seasonNumber/:episodeNumber',
  },
  async ({
    profileId,
    parentTmdbId,
    seasonNumber,
    episodeNumber,
  }: {
    profileId: string;
    parentTmdbId: string;
    seasonNumber: string;
    episodeNumber: string;
  }): Promise<{ state: { content_uid: string; last_position_seconds: number; total_duration_seconds: number | null; completed: boolean; completed_at: string | null; last_watched_at: string | null } | null }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const hasAccess = await verifyProfileAccess(profileId, auth.userID);
    if (!hasAccess) {
      throw APIError.permissionDenied('Profile not found or access denied');
    }

    const pad2 = (n: number) => String(n).padStart(2, '0');
    const uid = `tmdb:tv:${parentTmdbId}:s${pad2(Number(seasonNumber))}:e${pad2(Number(episodeNumber))}`;
    const res = await getWatchStateByUid({ profileId, contentUid: uid });
    return res;
  }
);

// Season aggregate: returns all episode rows for a season by TMDB parent id
export const getSeasonWatchStatesByTmdb = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/profiles/:profileId/watch-state/season/:parentTmdbId/:seasonNumber',
  },
  async ({
    profileId,
    parentTmdbId,
    seasonNumber,
  }: {
    profileId: string;
    parentTmdbId: string;
    seasonNumber: string;
  }): Promise<{ items: { content_uid: string; last_position_seconds: number; total_duration_seconds: number | null; completed: boolean; last_watched_at: string | null }[] }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const hasAccess = await verifyProfileAccess(profileId, auth.userID);
    if (!hasAccess) {
      throw APIError.permissionDenied('Profile not found or access denied');
    }

    const prefix = `tmdb:tv:${parentTmdbId}:s${String(Number(seasonNumber)).padStart(2, '0')}:`;
    const rows = userDB.query<{
      content_uid: string;
      last_position_seconds: number;
      total_duration_seconds: number | null;
      completed: boolean;
      last_watched_at: Date | null;
    }>`
      SELECT content_uid, last_position_seconds, total_duration_seconds, completed, last_watched_at
      FROM profile_watch_state
      WHERE profile_id = ${profileId} AND content_uid LIKE ${prefix + '%'}
      ORDER BY last_watched_at DESC NULLS LAST
    `;

    const items: { content_uid: string; last_position_seconds: number; total_duration_seconds: number | null; completed: boolean; last_watched_at: string | null }[] = [];
    for await (const r of rows) {
      items.push({
        content_uid: r.content_uid,
        last_position_seconds: r.last_position_seconds,
        total_duration_seconds: r.total_duration_seconds,
        completed: !!r.completed,
        last_watched_at: r.last_watched_at ? r.last_watched_at.toISOString() : null,
      });
    }
    return { items };
  }
);
