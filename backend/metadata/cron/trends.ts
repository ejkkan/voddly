import { CronJob } from 'encore.dev/cron';
import { getTrends, type ContentType, type TrendFeed } from '../endpoints/trends';
import log from 'encore.dev/log';

const feeds: { feed: TrendFeed; content_type: ContentType; limit: number }[] = [
  { feed: 'trending', content_type: 'movie', limit: 100 },
  { feed: 'trending', content_type: 'tv', limit: 100 },
  { feed: 'popular', content_type: 'movie', limit: 50 },
  { feed: 'popular', content_type: 'tv', limit: 50 },
  { feed: 'watched_weekly', content_type: 'movie', limit: 50 },
  { feed: 'watched_weekly', content_type: 'tv', limit: 50 },
  { feed: 'anticipated', content_type: 'movie', limit: 50 },
  { feed: 'anticipated', content_type: 'tv', limit: 50 },
];

export const refreshTrends = new CronJob('refresh-trends', {
  title: 'Refresh Trakt trends cache',
  every: '1h',
  endpoint: async () => {
    for (const f of feeds) {
      try {
        await getTrends({ feed: f.feed, content_type: f.content_type, limit: f.limit });
      } catch (e) {
        log.warn('Trends cron fetch failed', { feed: f.feed, content_type: f.content_type, error: String(e) });
      }
    }
  },
});