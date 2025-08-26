import { api, APIError } from 'encore.dev/api';
import log from 'encore.dev/log';
import { getTrends } from '../../metadata/endpoints/trends';

export type TrendFeed =
  | 'trending'
  | 'popular'
  | 'watched_weekly'
  | 'played_weekly'
  | 'collected_weekly'
  | 'anticipated'
  | 'releases'
  | 'premieres';

export type ContentType = 'movie' | 'tv';

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
    content_type: ContentType;
    limit?: number;
  }) => {
    if (!feed) throw APIError.badRequest('feed is required');
    if (content_type !== 'movie' && content_type !== 'tv') throw APIError.badRequest('invalid content_type');
    const res = await getTrends({ feed, content_type, limit });
    return res;
  }
);