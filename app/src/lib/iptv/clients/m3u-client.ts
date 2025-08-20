'use client';

import type { CatalogResult, IptvClient } from './base';

export class M3UIptvClient implements IptvClient {
  private readonly server: string;
  constructor(server: string) {
    this.server = server.endsWith('/') ? server.slice(0, -1) : server;
  }

  async getCatalog(): Promise<CatalogResult> {
    const url = this.server.includes('m3u')
      ? this.server
      : `${this.server}/get.php?username=-&password=-&type=m3u_plus&output=m3u8`;
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
    return { categories: [], movies: [], series: [], channels };
  }
}
