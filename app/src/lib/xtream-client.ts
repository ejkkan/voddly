'use client';

export type XtreamCredentials = {
  server: string;
  username: string;
  password: string;
};

type FetchOptions = {
  timeoutMs?: number;
  cache?: RequestCache;
};

async function fetchWithTimeout(
  input: string,
  { timeoutMs = 10000, cache = 'no-store' }: FetchOptions = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { signal: controller.signal, cache });
  } finally {
    clearTimeout(timeout);
  }
}

export class XtreamUrlBuilder {
  private readonly creds: XtreamCredentials;
  constructor(creds: XtreamCredentials) {
    this.creds = creds;
  }
  private base(): string {
    return this.creds.server.endsWith('/')
      ? this.creds.server.slice(0, -1)
      : this.creds.server;
  }
  private query(
    action: string,
    params: Record<string, string | number> = {}
  ): string {
    const url = new URL(`${this.base()}/player_api.php`);
    const search = new URLSearchParams({
      username: this.creds.username,
      password: this.creds.password,
      action,
    });
    for (const [k, v] of Object.entries(params)) search.set(k, String(v));
    url.search = search.toString();
    return url.toString();
  }

  // Categories
  getLiveCategories(): string {
    return this.query('get_live_categories');
  }
  getVodCategories(): string {
    return this.query('get_vod_categories');
  }
  getSeriesCategories(): string {
    return this.query('get_series_categories');
  }

  // Listings
  getLiveStreams(): string {
    return this.query('get_live_streams');
  }
  getVodStreams(): string {
    return this.query('get_vod_streams');
  }
  getSeriesList(): string {
    return this.query('get_series');
  }
  getLiveStreamsByCategory(categoryId: string | number): string {
    return this.query('get_live_streams', { category_id: categoryId });
  }
  getVodStreamsByCategory(categoryId: string | number): string {
    return this.query('get_vod_streams', { category_id: categoryId });
  }
  getSeriesByCategory(categoryId: string | number): string {
    return this.query('get_series', { category_id: categoryId });
  }

  // Details
  getVodInfo(vodId: string | number): string {
    return this.query('get_vod_info', { vod_id: vodId });
  }
  getSeriesInfo(seriesId: string | number): string {
    return this.query('get_series_info', { series_id: seriesId });
  }
  getShortEpg(streamId: string | number, limit = 10): string {
    return this.query('get_short_epg', { stream_id: streamId, limit });
  }
}

export class XtreamClient {
  private readonly creds: XtreamCredentials;
  private readonly urls: XtreamUrlBuilder;
  constructor(creds: XtreamCredentials) {
    this.creds = creds;
    this.urls = new XtreamUrlBuilder(creds);
  }

  // Expose URL helpers in case callers need to construct URLs without fetching
  get url() {
    return this.urls;
  }

  async json<T = any>(url: string, opts?: FetchOptions): Promise<T> {
    const text = await fetchWithTimeout(url, opts).then((r) => r.text());
    try {
      return JSON.parse(text) as T;
    } catch {
      // Some servers return invalid JSON sporadically. Treat as empty.
      return [] as unknown as T;
    }
  }

  // Categories
  async getLiveCategories(): Promise<any[]> {
    return this.json<any[]>(this.urls.getLiveCategories());
  }
  async getVodCategories(): Promise<any[]> {
    return this.json<any[]>(this.urls.getVodCategories());
  }
  async getSeriesCategories(): Promise<any[]> {
    return this.json<any[]>(this.urls.getSeriesCategories());
  }

  // Listings
  async getLiveStreams(): Promise<any[]> {
    return this.json<any[]>(this.urls.getLiveStreams());
  }
  async getVodStreams(): Promise<any[]> {
    return this.json<any[]>(this.urls.getVodStreams());
  }
  async getSeriesList(): Promise<any[]> {
    return this.json<any[]>(this.urls.getSeriesList());
  }
  async getLiveStreamsByCategory(categoryId: string | number): Promise<any[]> {
    return this.json<any[]>(this.urls.getLiveStreamsByCategory(categoryId));
  }
  async getVodStreamsByCategory(categoryId: string | number): Promise<any[]> {
    return this.json<any[]>(this.urls.getVodStreamsByCategory(categoryId));
  }
  async getSeriesByCategory(categoryId: string | number): Promise<any[]> {
    return this.json<any[]>(this.urls.getSeriesByCategory(categoryId));
  }

  // Details
  async getVodInfo(vodId: string | number): Promise<any | null> {
    const data = await this.json<any>(this.urls.getVodInfo(vodId));
    return data ?? null;
  }
  async getSeriesInfo(seriesId: string | number): Promise<any | null> {
    const data = await this.json<any>(this.urls.getSeriesInfo(seriesId));
    return data ?? null;
  }
  async getShortEpg(
    streamId: string | number,
    limit = 10
  ): Promise<any | null> {
    const data = await this.json<any>(this.urls.getShortEpg(streamId, limit));
    return data ?? null;
  }

  // Aggregate
  async getCatalog(): Promise<{
    categories: Array<any & { type: 'live' | 'vod' | 'series' }>;
    movies: any[];
    series: any[];
    channels: any[];
  }> {
    const [liveCategories, vodCategories, seriesCategories] = await Promise.all(
      [
        this.getLiveCategories().catch(() => []),
        this.getVodCategories().catch(() => []),
        this.getSeriesCategories().catch(() => []),
      ]
    );

    const categories = [
      ...(Array.isArray(liveCategories) ? liveCategories : []).map(
        (cat: any) => ({ ...cat, type: 'live' as const })
      ),
      ...(Array.isArray(vodCategories) ? vodCategories : []).map(
        (cat: any) => ({ ...cat, type: 'vod' as const })
      ),
      ...(Array.isArray(seriesCategories) ? seriesCategories : []).map(
        (cat: any) => ({ ...cat, type: 'series' as const })
      ),
    ];

    const [liveStreams, vodStreams, seriesList] = await Promise.all([
      this.getLiveStreams().catch(() => []),
      this.getVodStreams().catch(() => []),
      this.getSeriesList().catch(() => []),
    ]);

    return {
      categories,
      movies: Array.isArray(vodStreams) ? vodStreams : [],
      series: Array.isArray(seriesList) ? seriesList : [],
      channels: Array.isArray(liveStreams) ? liveStreams : [],
    } as const;
  }
}
