import { api, APIError } from 'encore.dev/api';
import log from 'encore.dev/log';
import { getAuthData } from '~encore/auth';
import { metadata } from '~encore/clients';

export type TrendFeed =
  | 'trending'
  | 'popular'
  | 'watched_weekly'
  | 'played_weekly'
  | 'collected_weekly'
  | 'anticipated'
  | 'releases'
  | 'premieres';

export type TrendsContentType = 'movie' | 'tv';

export interface TrendItem {
  rank: number;
  content_type: TrendsContentType;
  tmdb_id?: number | null;
  trakt_id: number;
  slug?: string | null;
  title: string;
  year?: number | null;
  metrics?: Record<string, number>;
  event_date?: string | null;
}

export interface TrendsResponse {
  key: string;
  run_at: string;
  items: TrendItem[];
  count: number;
}

export const getDashboardTrends = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/user/trends',
  },
  async ({
    feed,
    content_type,
    limit,
  }: {
    feed: TrendFeed;
    content_type: TrendsContentType;
    limit?: number;
    refresh?: boolean;
  }): Promise<TrendsResponse> => {
    const auth = getAuthData();
    log.info('getDashboardTrends:start', {
      feed,
      content_type,
      limit,
      user_id: auth?.userID || null,
      session_present: !!auth,
    });

    if (!feed) throw APIError.invalidArgument('feed is required');
    if (content_type !== 'movie' && content_type !== 'tv')
      throw APIError.invalidArgument('invalid content_type');

    // Call metadata trends endpoint
    const response = await metadata.getTrendsFromDB({
      feed,
      content_type,
      limit,
    });

    log.info('getDashboardTrends:metadata_response', {
      feed,
      content_type,
      count: response.count,
    });

    return response;
  }
);
