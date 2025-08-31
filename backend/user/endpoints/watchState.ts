import { api, APIError } from 'encore.dev/api';
import { userDB } from '../db';
import { getAuthData } from '~encore/auth';

interface UpdateWatchStateRequest {
  profileId: string;
  contentId: string; // Format: {uuid}:{type}:{id}
  contentType?: string;
  lastPositionSeconds?: number | null;
  totalDurationSeconds?: number | null;
  // Player preferences
  playbackSpeed?: number | null;
  audioTrack?: string | null;
  subtitleTrack?: string | null;
  qualityPreference?: string | null;
  // Skip markers
  skipIntroStart?: number | null;
  skipIntroEnd?: number | null;
  skipOutroStart?: number | null;
  // Mark as completed
  completed?: boolean;
}

interface GetWatchStateResponse {
  states: Array<{
    content_id: string;
    content_type: string | null;
    last_position_seconds: number | null;
    total_duration_seconds: number | null;
    watch_count: number;
    first_watched_at: string;
    last_watched_at: string;
    completed_at: string | null;
    playback_speed: number | null;
    audio_track: string | null;
    subtitle_track: string | null;
    quality_preference: string | null;
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
    contentId,
    contentType,
    lastPositionSeconds,
    totalDurationSeconds,
    playbackSpeed,
    audioTrack,
    subtitleTrack,
    qualityPreference,
    skipIntroStart,
    skipIntroEnd,
    skipOutroStart,
    completed,
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

    // Prepare values with proper types
    const playbackSpeedValue = playbackSpeed !== undefined && playbackSpeed !== null 
      ? Number(playbackSpeed) 
      : null;
    
    await userDB.exec`
      INSERT INTO profile_watch_state (
        profile_id, content_id, content_type,
        last_position_seconds, total_duration_seconds,
        watch_count, first_watched_at, last_watched_at,
        completed_at, playback_speed, audio_track,
        subtitle_track, quality_preference,
        skip_intro_start, skip_intro_end, skip_outro_start
      ) VALUES (
        ${profileId}, ${contentId}, ${contentType || null},
        ${lastPositionSeconds ?? 0}, ${totalDurationSeconds ?? null},
        1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
        ${completed ? new Date() : null},
        ${playbackSpeedValue}, 
        ${audioTrack ?? null},
        ${subtitleTrack ?? null}, ${qualityPreference ?? null},
        ${skipIntroStart ?? null}, ${skipIntroEnd ?? null}, ${skipOutroStart ?? null}
      )
      ON CONFLICT (profile_id, content_id)
      DO UPDATE SET 
        content_type = COALESCE(EXCLUDED.content_type, profile_watch_state.content_type),
        last_position_seconds = COALESCE(EXCLUDED.last_position_seconds, profile_watch_state.last_position_seconds),
        total_duration_seconds = COALESCE(EXCLUDED.total_duration_seconds, profile_watch_state.total_duration_seconds),
        watch_count = profile_watch_state.watch_count + 1,
        last_watched_at = CURRENT_TIMESTAMP,
        completed_at = CASE 
          WHEN ${completed} = TRUE THEN CURRENT_TIMESTAMP 
          ELSE profile_watch_state.completed_at 
        END,
        playback_speed = COALESCE(EXCLUDED.playback_speed, profile_watch_state.playback_speed),
        audio_track = COALESCE(EXCLUDED.audio_track, profile_watch_state.audio_track),
        subtitle_track = COALESCE(EXCLUDED.subtitle_track, profile_watch_state.subtitle_track),
        quality_preference = COALESCE(EXCLUDED.quality_preference, profile_watch_state.quality_preference),
        skip_intro_start = COALESCE(EXCLUDED.skip_intro_start, profile_watch_state.skip_intro_start),
        skip_intro_end = COALESCE(EXCLUDED.skip_intro_end, profile_watch_state.skip_intro_end),
        skip_outro_start = COALESCE(EXCLUDED.skip_outro_start, profile_watch_state.skip_outro_start)
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
      watch_count: number;
      first_watched_at: Date;
      last_watched_at: Date;
      completed_at: Date | null;
      playback_speed: number | null;
      audio_track: string | null;
      subtitle_track: string | null;
      quality_preference: string | null;
    }>`
      SELECT 
        content_id, 
        content_type, 
        last_position_seconds, 
        total_duration_seconds,
        watch_count,
        first_watched_at,
        last_watched_at,
        completed_at,
        playback_speed,
        audio_track,
        subtitle_track,
        quality_preference
      FROM profile_watch_state
      WHERE profile_id = ${profileId}
      ORDER BY last_watched_at DESC
    `;

    const states = [];
    for await (const row of rows) {
      states.push({
        ...row,
        first_watched_at: row.first_watched_at.toISOString(),
        last_watched_at: row.last_watched_at.toISOString(),
        completed_at: row.completed_at ? row.completed_at.toISOString() : null,
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
      watch_count: number;
      first_watched_at: string;
      last_watched_at: string;
      completed_at: string | null;
      playback_speed: number | null;
      audio_track: string | null;
      subtitle_track: string | null;
      quality_preference: string | null;
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
      watch_count: number;
      first_watched_at: Date;
      last_watched_at: Date;
      completed_at: Date | null;
      playback_speed: number | null;
      audio_track: string | null;
      subtitle_track: string | null;
      quality_preference: string | null;
    }>`
      SELECT 
        content_id, 
        content_type, 
        last_position_seconds, 
        total_duration_seconds,
        watch_count,
        first_watched_at,
        last_watched_at,
        completed_at,
        playback_speed,
        audio_track,
        subtitle_track,
        quality_preference
      FROM profile_watch_state
      WHERE profile_id = ${profileId} AND content_id = ${contentId}
    `;

    if (!state) {
      return { state: null };
    }

    return {
      state: {
        ...state,
        first_watched_at: state.first_watched_at.toISOString(),
        last_watched_at: state.last_watched_at.toISOString(),
        completed_at: state.completed_at ? state.completed_at.toISOString() : null,
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
      content_id: string;
      last_position_seconds: number;
      total_duration_seconds: number | null;
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
      content_id: string;
      last_position_seconds: number;
      total_duration_seconds: number | null;
      completed_at: Date | null;
      last_watched_at: Date | null;
    }>`
      SELECT content_id, last_position_seconds, total_duration_seconds, completed_at, last_watched_at
      FROM profile_watch_state
      WHERE profile_id = ${profileId} AND content_id = ${contentUid}
    `;

    if (!row) return { state: null };

    return {
      state: {
        content_id: row.content_id,
        last_position_seconds: row.last_position_seconds,
        total_duration_seconds: row.total_duration_seconds,
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
  }): Promise<{ state: { content_id: string; last_position_seconds: number; total_duration_seconds: number | null; completed_at: string | null; last_watched_at: string | null } | null }> => {
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
  }): Promise<{ state: { content_id: string; last_position_seconds: number; total_duration_seconds: number | null; completed_at: string | null; last_watched_at: string | null } | null }> => {
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
  }): Promise<{ items: { content_id: string; last_position_seconds: number; total_duration_seconds: number | null; completed_at: string | null; last_watched_at: string | null }[] }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const hasAccess = await verifyProfileAccess(profileId, auth.userID);
    if (!hasAccess) {
      throw APIError.permissionDenied('Profile not found or access denied');
    }

    const prefix = `tmdb:tv:${parentTmdbId}:s${String(Number(seasonNumber)).padStart(2, '0')}:`;
    const rows = userDB.query<{
      content_id: string;
      last_position_seconds: number;
      total_duration_seconds: number | null;
      completed_at: Date | null;
      last_watched_at: Date | null;
    }>`
      SELECT content_id, last_position_seconds, total_duration_seconds, completed_at, last_watched_at
      FROM profile_watch_state
      WHERE profile_id = ${profileId} AND content_id LIKE ${prefix + '%'}
      ORDER BY last_watched_at DESC NULLS LAST
    `;

    const items: { content_id: string; last_position_seconds: number; total_duration_seconds: number | null; completed_at: string | null; last_watched_at: string | null }[] = [];
    for await (const r of rows) {
      items.push({
        content_id: r.content_id,
        last_position_seconds: r.last_position_seconds,
        total_duration_seconds: r.total_duration_seconds,
        completed_at: r.completed_at ? r.completed_at.toISOString() : null,
        last_watched_at: r.last_watched_at ? r.last_watched_at.toISOString() : null,
      });
    }
    return { items };
  }
);
