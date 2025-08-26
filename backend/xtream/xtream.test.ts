import { describe, it, expect } from 'vitest';
import {
  analyzePlaylist,
  analyzeM3U,
  quickStats,
  getServerInfo,
} from './xtream';

const maybe = process.env.RUN_XTREAM_TESTS ? describe : describe.skip;

maybe('Xtream service', () => {
  it('should return server info', async () => {
    const info = await getServerInfo();
    expect(info).toBeDefined();
    expect(info.servers).toHaveLength(2);
    expect(info.defaultCredentials.username).toBe('ngArk2Up');
  });

  it('should perform quick stats check', async () => {
    const stats = await quickStats({});
    expect(stats).toBeDefined();
    expect(stats.serverUsed).toBeDefined();
    expect(stats.responseTime).toBeGreaterThan(0);
    expect(['online', 'offline']).toContain(stats.serverStatus);
  });

  it('should analyze playlist with default credentials (Xtream API)', async () => {
    const analysis = await analyzePlaylist({});
    expect(analysis).toBeDefined();
    expect(analysis.totalSize).toBeGreaterThanOrEqual(0);
    expect(analysis.serverUsed).toBeDefined();
    expect(analysis.timestamp).toBeDefined();
    expect(analysis.breakdown).toBeDefined();
    expect(analysis.analysisType).toBe('xtream_api');
    expect(analysis.m3uStats).toBeUndefined();
  }, 30000); // 30 second timeout for this test

  it('should analyze playlist with M3U mode enabled', async () => {
    const analysis = await analyzePlaylist({ useM3U: true });
    expect(analysis).toBeDefined();
    expect(analysis.totalSize).toBeGreaterThanOrEqual(0);
    expect(analysis.serverUsed).toBeDefined();
    expect(analysis.timestamp).toBeDefined();
    expect(analysis.breakdown).toBeDefined();
    expect(analysis.analysisType).toBe('m3u_playlist');
    expect(analysis.m3uStats).toBeDefined();
    expect(analysis.m3uStats?.totalLines).toBeGreaterThan(0);
    expect(analysis.m3uStats?.validEntries).toBeGreaterThanOrEqual(0);
    expect(analysis.m3uStats?.playlistSize).toBeGreaterThan(0);
    expect(Array.isArray(analysis.m3uStats?.sampleChannels)).toBe(true);
  }, 30000); // 30 second timeout for this test

  it('should analyze M3U playlist using dedicated endpoint', async () => {
    const analysis = await analyzeM3U({});
    expect(analysis).toBeDefined();
    expect(analysis.totalSize).toBeGreaterThanOrEqual(0);
    expect(analysis.serverUsed).toBeDefined();
    expect(analysis.timestamp).toBeDefined();
    expect(analysis.breakdown).toBeDefined();
    expect(analysis.analysisType).toBe('m3u_playlist');
    expect(analysis.m3uStats).toBeDefined();
    expect(analysis.m3uStats?.totalLines).toBeGreaterThan(0);
    expect(analysis.m3uStats?.validEntries).toBeGreaterThanOrEqual(0);
    expect(analysis.m3uStats?.playlistSize).toBeGreaterThan(0);
    expect(Array.isArray(analysis.m3uStats?.sampleChannels)).toBe(true);
  }, 30000); // 30 second timeout for this test

  it('should analyze M3U playlist with custom server', async () => {
    const analysis = await analyzeM3U({
      server: 'http://nordicstream.xyz:2095',
    });
    expect(analysis).toBeDefined();
    expect(analysis.serverUsed).toBe('http://nordicstream.xyz:2095');
    expect(analysis.analysisType).toBe('m3u_playlist');
  }, 30000); // 30 second timeout for this test
});
