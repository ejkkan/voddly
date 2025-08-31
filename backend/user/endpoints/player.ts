import { api, APIError } from 'encore.dev/api';
import { getAuthData } from '~encore/auth';
import { userDB } from '../db';

interface GetPlayerBundleRequest {
  profileId: string;
  contentId: string;
}

export interface PlayerBundleResponse {
  content_id: string;
  watch_state: {
    last_position_seconds: number;
    total_duration_seconds: number | null;
    completed: boolean;
    last_watched_at: string | null;
  } | null;
}

export const getPlayerBundle = api(
  { expose: true, auth: true, method: 'GET', path: '/player/:profileId/:contentId' },
  async ({ profileId, contentId }: GetPlayerBundleRequest): Promise<PlayerBundleResponse> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Verify profile belongs to user
    const owns = await userDB.queryRow<{ id: string }>`
      SELECT p.id
      FROM profiles p
      JOIN user_subscription a ON p.subscription_id = a.id
      WHERE p.id = ${profileId} AND a.user_id = ${auth.userID}
    `;
    if (!owns) throw APIError.permissionDenied('Profile not found or access denied');

    const row = await userDB.queryRow<{
      last_position_seconds: number;
      total_duration_seconds: number | null;
      completed: boolean;
      last_watched_at: Date | null;
    }>`
      SELECT last_position_seconds, total_duration_seconds, completed, last_watched_at
      FROM profile_watch_state
      WHERE profile_id = ${profileId} AND content_id = ${contentId}
    `;

    return {
      content_id: contentId,
      watch_state: row
        ? {
            last_position_seconds: row.last_position_seconds,
            total_duration_seconds: row.total_duration_seconds,
            completed: !!row.completed,
            last_watched_at: row.last_watched_at ? row.last_watched_at.toISOString() : null,
          }
        : null,
    };
  }
);

