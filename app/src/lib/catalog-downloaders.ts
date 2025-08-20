'use client';

import { XtreamClient, type XtreamCredentials } from './xtream-client';

export async function downloadXtreamCatalog(credentials: XtreamCredentials) {
  const client = new XtreamClient(credentials);
  return client.getCatalog();
}

export async function downloadM3UCatalog(server: string) {
  const cleaned = server.endsWith('/') ? server.slice(0, -1) : server;
  const url = cleaned.includes('m3u')
    ? cleaned
    : `${cleaned}/get.php?username=-&password=-&type=m3u_plus&output=m3u8`;
  const text = await fetch(url).then((r) => r.text());
  const channels: any[] = [];
  const lines = text.split(/\r?\n/);
  let current: any = null;
  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      const nameMatch = line.split(',');
      current = { name: nameMatch[nameMatch.length - 1] || 'Unknown' };
    } else if (line && !line.startsWith('#')) {
      if (current) {
        current.url = line;
        channels.push(current);
        current = null;
      }
    }
  }
  return { categories: [], movies: [], series: [], channels } as const;
}
