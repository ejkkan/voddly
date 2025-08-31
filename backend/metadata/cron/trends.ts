import { CronJob } from 'encore.dev/cron';
import { api } from 'encore.dev/api';
import { updateTrends, type TrendFeed } from '../endpoints/trends';
import log from 'encore.dev/log';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const feeds: {
  feed: TrendFeed;
  content_type: 'movie' | 'tv';
  limit: number;
}[] = [
  { feed: 'trending', content_type: 'movie', limit: 50 },
  { feed: 'trending', content_type: 'tv', limit: 50 },
  { feed: 'popular', content_type: 'movie', limit: 50 },
  { feed: 'popular', content_type: 'tv', limit: 50 },
  { feed: 'watched_weekly', content_type: 'movie', limit: 50 },
  { feed: 'watched_weekly', content_type: 'tv', limit: 50 },
  { feed: 'played_weekly', content_type: 'movie', limit: 50 },
  { feed: 'played_weekly', content_type: 'tv', limit: 50 },
  { feed: 'collected_weekly', content_type: 'movie', limit: 50 },
  { feed: 'collected_weekly', content_type: 'tv', limit: 50 },
  { feed: 'anticipated', content_type: 'movie', limit: 50 },
  { feed: 'anticipated', content_type: 'tv', limit: 50 },
  // Trakt calendar feeds
  { feed: 'releases', content_type: 'movie', limit: 50 },
  { feed: 'premieres', content_type: 'tv', limit: 50 },
];

export async function refreshTrendsTask(): Promise<void> {
  for (const f of feeds) {
    try {
      log.info('refreshTrendsTask', {
        message: 'Refreshing trends',
        feed: f.feed,
        content_type: f.content_type,
        limit: f.limit,
      });
      const t0 = Date.now();
      await updateTrends({
        feed: f.feed,
        content_type: f.content_type,
        limit: f.limit,
      });
      const dt = Date.now() - t0;
      log.info('refreshTrendsTask:done', {
        feed: f.feed,
        content_type: f.content_type,
        ms: dt,
      });
    } catch (e) {
      log.warn('Trends cron fetch failed', {
        feed: f.feed,
        content_type: f.content_type,
        error: String(e),
      });
    }
    // Rate-limit subsequent requests to Trakt to avoid hitting burst limits
    log.info('refreshTrendsTask:sleep', { ms: 1000, next_feed: f.feed });
    await sleep(1000);
  }
}

export const refreshTrendsEndpoint = api(
  {
    expose: false,
    auth: false,
    method: 'POST',
    path: '/metadata/cron/refresh-trends',
  },
  async (): Promise<void> => {
    log.info('refreshTrendsEndpoint', { message: 'Refreshing trends' });
    await refreshTrendsTask();
  }
);

export const cronJob = new CronJob('refresh-trends', {
  title: 'Refresh Trakt trends data',
  schedule: '0 */6 * * *', // Run every 6 hours
  endpoint: refreshTrendsEndpoint,
});
