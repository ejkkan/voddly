import { describe, test, expect, beforeEach, vi } from 'vitest';

const mockUserDB = {
  queryRow: vi.fn(),
  query: vi.fn(),
  exec: vi.fn(),
};

vi.mock('../db', () => ({ userDB: mockUserDB }));
vi.mock('~encore/auth', () => ({ getAuthData: () => ({ userID: 'u1' }) }));

import { addFavorite, removeFavorite, listFavorites } from './favorites';

function makeAsyncIterable<T>(items: T[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
  } as AsyncIterable<T>;
}

describe('Favorites endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserDB.queryRow.mockResolvedValue({ id: 'p1' });
  });

  test('addFavorite inserts', async () => {
    mockUserDB.exec.mockResolvedValue(undefined);
    const res = await addFavorite({
      profileId: 'p1',
      contentUid: 'tmdb:movie:1',
      contentType: 'movie',
    } as any);
    expect(res.ok).toBe(true);
    expect(mockUserDB.exec).toHaveBeenCalledTimes(1);
  });

  test('removeFavorite deletes', async () => {
    mockUserDB.exec.mockResolvedValue(undefined);
    const res = await removeFavorite({
      profileId: 'p1',
      contentUid: 'tmdb:movie:1',
    } as any);
    expect(res.ok).toBe(true);
    expect(mockUserDB.exec).toHaveBeenCalledTimes(1);
  });

  test('listFavorites returns rows', async () => {
    mockUserDB.query.mockReturnValueOnce(
      makeAsyncIterable([
        {
          content_uid: 'tmdb:movie:1',
          content_type: 'movie',
          added_at: new Date('2024-01-01T00:00:00Z'),
        },
      ])
    );
    const res = await listFavorites({ profileId: 'p1' } as any);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].content_uid).toBe('tmdb:movie:1');
    expect(res.items[0].content_type).toBe('movie');
  });
});
