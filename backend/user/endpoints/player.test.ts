import { describe, test, expect, beforeEach, vi } from 'vitest';

const mockUserDB = {
  queryRow: vi.fn(),
  query: vi.fn(),
  exec: vi.fn(),
};

vi.mock('../db', () => ({ userDB: mockUserDB }));
vi.mock('~encore/auth', () => ({ getAuthData: () => ({ userID: 'u1' }) }));

import { getPlayerBundle } from './player';

describe('Player endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserDB.queryRow.mockResolvedValueOnce({ id: 'p1' }); // verifyProfile
  });

  test('returns watch_state when present', async () => {
    // After verifyProfile, next queryRow for watch_state
    mockUserDB.queryRow.mockResolvedValueOnce({
      last_position_seconds: 120,
      total_duration_seconds: 300,
      completed: false,
      completed_at: null,
      last_watched_at: new Date('2024-01-01T00:00:00Z'),
    });

    const res = await getPlayerBundle({ profileId: 'p1', contentUid: 'tmdb:movie:1' } as any);
    expect(res.content_uid).toBe('tmdb:movie:1');
    expect(res.watch_state?.last_position_seconds).toBe(120);
  });

  test('returns null watch_state when not found', async () => {
    mockUserDB.queryRow.mockResolvedValueOnce(null); // verifyProfile
    // Force verifyProfile to pass, then watch state null
    mockUserDB.queryRow.mockResolvedValueOnce({ id: 'p1' });
    mockUserDB.queryRow.mockResolvedValueOnce(null);

    const res = await getPlayerBundle({ profileId: 'p1', contentUid: 'tmdb:movie:2' } as any);
    expect(res.watch_state).toBeNull();
  });
});

