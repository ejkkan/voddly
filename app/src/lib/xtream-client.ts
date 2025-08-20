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
    let response: Response;
    try {
      response = await fetchWithTimeout(url, opts);
    } catch (err) {
      if (__DEV__) console.log('[xtream] fetch failed', { url, err: String(err) });
      throw err;
    }
    let text: string;
    try {
      text = await response.text();
    } catch (err) {
      if (__DEV__) console.log('[xtream] read body failed', { url, err: String(err) });
      throw err;
    }
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      if (__DEV__)
        console.log('[xtream] invalid JSON', {
          url,
          sample: text.slice(0, 200),
        });
      throw new Error('Invalid JSON from server');
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
    const catResults = await Promise.allSettled([
      this.getLiveCategories(),
      this.getVodCategories(),
      this.getSeriesCategories(),
    ]);
    const [liveCatRes, vodCatRes, seriesCatRes] = catResults;
    const liveCategories =
      liveCatRes.status === 'fulfilled' && Array.isArray(liveCatRes.value)
        ? liveCatRes.value
        : [];
    const vodCategories =
      vodCatRes.status === 'fulfilled' && Array.isArray(vodCatRes.value)
        ? vodCatRes.value
        : [];
    const seriesCategories =
      seriesCatRes.status === 'fulfilled' && Array.isArray(seriesCatRes.value)
        ? seriesCatRes.value
        : [];

    const categories = [
      ...liveCategories.map((cat: any) => ({ ...cat, type: 'live' as const })),
      ...vodCategories.map((cat: any) => ({ ...cat, type: 'vod' as const })),
      ...seriesCategories.map((cat: any) => ({ ...cat, type: 'series' as const })),
    ];

    const streamResults = await Promise.allSettled([
      this.getLiveStreams(),
      this.getVodStreams(),
      this.getSeriesList(),
    ]);
    const [liveRes, vodRes, seriesRes] = streamResults;
    const liveStreams =
      liveRes.status === 'fulfilled' && Array.isArray(liveRes.value)
        ? liveRes.value
        : [];
    const vodStreams =
      vodRes.status === 'fulfilled' && Array.isArray(vodRes.value)
        ? vodRes.value
        : [];
    const seriesList =
      seriesRes.status === 'fulfilled' && Array.isArray(seriesRes.value)
        ? seriesRes.value
        : [];

    const catFailures = catResults.filter((r) => r.status === 'rejected').length;
    const streamFailures = streamResults.filter((r) => r.status === 'rejected').length;
    if (catFailures === catResults.length && streamFailures === streamResults.length) {
      if (__DEV__)
        console.log('[xtream] all catalog fetches failed', {
          catErrors: catResults.map((r) => (r.status === 'rejected' ? String(r.reason) : null)),
          streamErrors: streamResults.map((r) => (r.status === 'rejected' ? String(r.reason) : null)),
        });
      throw new Error('Failed to fetch catalog from Xtream server');
    }

    return {
      categories,
      movies: vodStreams,
      series: seriesList,
      channels: liveStreams,
    } as const;
  }
}
