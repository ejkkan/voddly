import { api, APIError } from 'encore.dev/api';
import { userDB } from '../db';
import { getAuthData } from '~encore/auth';

interface UpdateWatchStateRequest {
  sourceId: string;
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

// Update watch state for a piece of content
export const updateWatchState = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/watch-state',
  },
  async ({
    sourceId,
    contentId,
    contentType,
    lastPositionSeconds,
    totalDurationSeconds,
    isFavorite,
  }: UpdateWatchStateRequest): Promise<{ ok: true }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    if (!sourceId || !contentId) {
      throw APIError.invalidArgument('sourceId and contentId are required');
    }

    await userDB.exec`
      INSERT INTO member_watch_state (
        user_id, source_id, content_id, content_type,
        last_position_seconds, total_duration_seconds, 
        is_favorite, last_watched_at
      ) VALUES (
        ${auth.userID}, ${sourceId}, ${contentId}, ${contentType || null},
        ${lastPositionSeconds ?? null}, ${totalDurationSeconds ?? null},
        ${isFavorite ?? false}, CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id, source_id, content_id)
      DO UPDATE SET 
        content_type = COALESCE(EXCLUDED.content_type, member_watch_state.content_type),
        last_position_seconds = COALESCE(EXCLUDED.last_position_seconds, member_watch_state.last_position_seconds),
        total_duration_seconds = COALESCE(EXCLUDED.total_duration_seconds, member_watch_state.total_duration_seconds),
        is_favorite = COALESCE(EXCLUDED.is_favorite, member_watch_state.is_favorite),
        last_watched_at = CURRENT_TIMESTAMP
    `;

    return { ok: true };
  }
);

// Get watch state for a source
export const getWatchState = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/watch-state/:sourceId',
  },
  async ({
    sourceId,
  }: {
    sourceId: string;
  }): Promise<GetWatchStateResponse> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

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
      FROM member_watch_state
      WHERE user_id = ${auth.userID} AND source_id = ${sourceId}
      ORDER BY last_watched_at DESC
    `;

    const states: GetWatchStateResponse['states'] = [];
    for await (const row of rows) {
      states.push({
        ...row,
        last_watched_at: row.last_watched_at.toISOString(),
      });
    }

    return { states };
  }
);

// Get favorite content across all sources
export const getFavorites = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/watch-state/favorites',
  },
  async (): Promise<GetWatchStateResponse> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

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
      FROM member_watch_state
      WHERE user_id = ${auth.userID} AND is_favorite = true
      ORDER BY last_watched_at DESC
      LIMIT 100
    `;

    const states: GetWatchStateResponse['states'] = [];
    for await (const row of rows) {
      states.push({
        ...row,
        last_watched_at: row.last_watched_at.toISOString(),
      });
    }

    return { states };
  }
);
