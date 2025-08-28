import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mocks must be declared before importing the SUT
const mockUserDB = {
  queryRow: vi.fn(),
  query: vi.fn(),
  exec: vi.fn(),
};

vi.mock('../db', () => ({ userDB: mockUserDB }));
vi.mock('~encore/auth', () => ({ getAuthData: () => ({ userID: 'u1' }) }));

// Provide crypto.randomUUID for createPlaylist
// @ts-expect-error test shim
globalThis.crypto = globalThis.crypto || {};
// @ts-expect-error test shim
globalThis.crypto.randomUUID = () => 'test-id';

// Import after mocks
import {
  listPlaylists,
  createPlaylist,
  deletePlaylist,
  listPlaylistItems,
  addPlaylistItem,
  removePlaylistItem,
} from './playlists';

function makeAsyncIterable<T>(items: T[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) {
        yield item;
      }
    },
  } as AsyncIterable<T>;
}

describe('Playlists endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserDB.queryRow.mockResolvedValue({ id: 'p1' });
  });

  test('listPlaylists returns rows', async () => {
    const rows = [
      { id: 'pl1', name: 'Watchlist', created_at: new Date('2024-01-01T00:00:00Z') },
      { id: 'pl2', name: 'My List', created_at: new Date('2024-02-01T00:00:00Z') },
    ];
    mockUserDB.query.mockReturnValueOnce(makeAsyncIterable(rows));

    const res = await listPlaylists({ profileId: 'p1' } as any);
    expect(res.playlists).toHaveLength(2);
    expect(res.playlists[0]).toMatchObject({ id: 'pl1', name: 'Watchlist' });
  });

  test('createPlaylist inserts and returns id', async () => {
    mockUserDB.exec.mockResolvedValue(undefined);
    const res = await createPlaylist({ profileId: 'p1', name: 'New' } as any);
    expect(res.id).toBe('test-id');
    expect(mockUserDB.exec).toHaveBeenCalledTimes(1);
  });

  test('deletePlaylist removes row', async () => {
    mockUserDB.exec.mockResolvedValue(undefined);
    const res = await deletePlaylist({ profileId: 'p1', playlistId: 'pl1' } as any);
    expect(res.ok).toBe(true);
    expect(mockUserDB.exec).toHaveBeenCalledTimes(1);
  });

  test('listPlaylistItems returns items', async () => {
    const items = [
      { content_uid: 'tmdb:movie:1', sort_order: 0, added_at: new Date('2024-01-01T00:00:00Z') },
    ];
    mockUserDB.query.mockReturnValueOnce(makeAsyncIterable(items));
    const res = await listPlaylistItems({ profileId: 'p1', playlistId: 'pl1' } as any);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].content_uid).toBe('tmdb:movie:1');
  });

  test('addPlaylistItem upserts', async () => {
    mockUserDB.exec.mockResolvedValue(undefined);
    const res = await addPlaylistItem({ profileId: 'p1', playlistId: 'pl1', contentUid: 'tmdb:movie:2' } as any);
    expect(res.ok).toBe(true);
    expect(mockUserDB.exec).toHaveBeenCalledTimes(1);
  });

  test('removePlaylistItem deletes', async () => {
    mockUserDB.exec.mockResolvedValue(undefined);
    const res = await removePlaylistItem({ profileId: 'p1', playlistId: 'pl1', contentUid: 'tmdb:movie:2' } as any);
    expect(res.ok).toBe(true);
    expect(mockUserDB.exec).toHaveBeenCalledTimes(1);
  });
});

