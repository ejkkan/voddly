import { api, APIError } from 'encore.dev/api';
import log from 'encore.dev/log';
import { getAuthData } from '~encore/auth';
import { metadata } from '~encore/clients';
import type { TrendFeed, TrendsContentType, TrendItem, TrendsResponse } from '../../metadata';

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
