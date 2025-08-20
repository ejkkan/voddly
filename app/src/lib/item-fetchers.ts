'use client';
import type { XtreamCredentials } from './xtream-client';
import { XtreamClient } from './xtream-client';

export async function fetchXtreamVodInfo(
  credentials: XtreamCredentials,
  vodId: string | number
): Promise<any | null> {
  try {
    const client = new XtreamClient(credentials as any);
    return await client.getVodInfo(vodId);
  } catch {
    return null;
  }
}

export async function fetchXtreamSeriesInfo(
  credentials: XtreamCredentials,
  seriesId: string | number
): Promise<any | null> {
  try {
    const client = new XtreamClient(credentials as any);
    return await client.getSeriesInfo(seriesId);
  } catch {
    return null;
  }
}

export async function fetchXtreamLiveShortEPG(
  credentials: XtreamCredentials,
  streamId: string | number,
  limit: number = 10
): Promise<any | null> {
  try {
    const client = new XtreamClient(credentials as any);
    return await client.getShortEpg(streamId, limit);
  } catch {
    return null;
  }
}
