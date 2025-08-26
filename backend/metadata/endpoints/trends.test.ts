import { describe, expect, test, vi, beforeEach } from 'vitest';
import * as db from '../db';
import * as endpoint from './trends';

// Helper to stub metadataDB
function mockDB() {
  const exec = vi.fn(async () => {});
  const queryRow = vi.fn(async () => null as any);
  vi.spyOn(db, 'metadataDB', 'get').mockReturnValue({ exec, queryRow } as any);
  return { exec, queryRow };
}

describe('metadata/trends endpoint', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('normalizes trending movies with tmdb id and metrics', async () => {
    const { exec, queryRow } = mockDB();

    // mock fresh cache miss
    queryRow.mockResolvedValueOnce(null);

    // mock Trakt client call via endpoint.fetchFromTrakt by spying on client method
    const clientMod = await vi.importActual<any>('../providers/trakt-client');
    const makeRequest = vi.spyOn(clientMod.TraktClient.prototype as any, 'getTrending');
    makeRequest.mockResolvedValueOnce([
      {
        watchers: 123,
        movie: { title: 'Test Movie', year: 2024, ids: { trakt: 1, tmdb: 999, slug: 'test' } },
      },
    ]);

    const res = await endpoint.getTrends({ feed: 'trending', content_type: 'movie', limit: 10 });

    expect(res.key).toBe('trakt:trending:movie');
    expect(res.items.length).toBe(1);
    expect(res.items[0]).toMatchObject({
      rank: 1,
      content_type: 'movie',
      tmdb_id: 999,
      trakt_id: 1,
      title: 'Test Movie',
      year: 2024,
    });
    expect(res.items[0].metrics?.watchers).toBe(123);
    // ensure cache written
    expect(exec).toHaveBeenCalled();
  });

  test('cache is returned if fresh; otherwise refetched and overwritten', async () => {
    const { exec, queryRow } = mockDB();

    // first, cache exists and is fresh
    const now = new Date();
    queryRow.mockResolvedValueOnce({ key: 'trakt:trending:tv', run_at: now, items: [{ rank: 1 }] });
    const cached = await endpoint.getTrends({ feed: 'trending', content_type: 'tv', limit: 5 });
    expect(cached.items.length).toBe(1);
    expect(exec).not.toHaveBeenCalled();

    // second, cache is stale -> fetch and overwrite
    const stale = new Date(Date.now() - 1000 * 60 * 60 * 2); // 2h
    queryRow.mockResolvedValueOnce({ key: 'trakt:trending:tv', run_at: stale, items: [{ rank: 1 }] });

    const clientMod = await vi.importActual<any>('../providers/trakt-client');
    const mockTrending = vi.spyOn(clientMod.TraktClient.prototype as any, 'getTrending');
    mockTrending.mockResolvedValueOnce([
      { watchers: 1, show: { title: 'Show', year: 2020, ids: { trakt: 2, tmdb: 100, slug: 'show' } } },
    ]);

    const fresh = await endpoint.getTrends({ feed: 'trending', content_type: 'tv', limit: 5 });
    expect(fresh.items.length).toBe(1);
    expect(exec).toHaveBeenCalled(); // cache overwrite
  });
});