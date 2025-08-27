import { secret } from 'encore.dev/config';
import log from 'encore.dev/log';

const traktClientId = secret('TraktClientId');
const traktClientSecret = secret('TraktClientSecret');

export interface TraktIds {
  trakt: number;
  slug: string;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
}

export interface TraktItem {
  title?: string;
  year?: number;
  ids: TraktIds;
}

export interface TraktSearchResult {
  type: string;
  score: number;
  movie?: TraktItem;
  show?: TraktItem;
}

export interface TraktStats {
  watchers: number;
  plays: number;
  collectors: number;
  collected_episodes?: number;
  comments: number;
  lists: number;
  votes: number;
  favorited: number;
  rating?: number;
}

export interface TraktRating {
  rating: number;
  votes: number;
  distribution: Record<string, number>;
}

export class TraktClient {
  private baseUrl = 'https://api.trakt.tv';
  private clientId: string | null = null;

  private async getClientId(): Promise<string> {
    if (!this.clientId) {
      this.clientId = await traktClientId();
    }
    return this.clientId;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async makeRequest<T>(
    endpoint: string,
    attempt: number = 1
  ): Promise<T | null> {
    try {
      const clientId = await this.getClientId();
      const url = `${this.baseUrl}${endpoint}`;
      const start = Date.now();
      log.debug('Trakt request start', { url });
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'trakt-api-version': '2',
          'trakt-api-key': clientId,
          'User-Agent': 'VoddlyMetadataService/1.0',
        },
      });

      if (!response.ok) {
        const durationMs = Date.now() - start;
        let bodyText: string | undefined;
        const debugHeaders: Record<string, string> = {};
        try {
          // Capture relevant headers (rate limiting, request id, retry-after)
          response.headers.forEach((value, key) => {
            const k = key.toLowerCase();
            if (
              k.includes('rate') ||
              k === 'retry-after' ||
              k === 'x-request-id'
            ) {
              debugHeaders[k] = value;
            }
          });
        } catch {}
        try {
          bodyText = await response.text();
        } catch {}
        log.warn('Trakt API error', {
          status: response.status,
          endpoint,
          durationMs,
          body: bodyText,
          headers: debugHeaders,
        });

        // Retry once on common transient statuses (rate limiting or forbidden due to burst)
        if (
          (response.status === 429 ||
            response.status === 403 ||
            (response.status >= 500 && response.status < 600)) &&
          attempt < 2
        ) {
          log.info('Trakt retrying request', {
            attempt: attempt + 1,
            endpoint,
            status: response.status,
          });
          await this.sleep(1200);
          return this.makeRequest<T>(endpoint, attempt + 1);
        }
        return null;
      }

      const durationMs = Date.now() - start;
      log.debug('Trakt request done', {
        endpoint,
        status: response.status,
        durationMs,
      });
      return (await response.json()) as T;
    } catch (error) {
      log.error('Trakt request failed', { error, endpoint });
      return null;
    }
  }

  async getByTMDBId(
    tmdbId: number,
    type: 'movie' | 'tv'
  ): Promise<TraktItem | null> {
    const traktType = type === 'tv' ? 'show' : 'movie';
    const results = await this.makeRequest<TraktSearchResult[]>(
      `/search/tmdb/${tmdbId}?type=${traktType}`
    );

    if (!results || results.length === 0) {
      return null;
    }

    return results[0][traktType] || null;
  }

  async getStats(
    traktId: string | number,
    type: 'movie' | 'tv'
  ): Promise<TraktStats | null> {
    const endpoint = type === 'tv' ? 'shows' : 'movies';
    return this.makeRequest<TraktStats>(`/${endpoint}/${traktId}/stats`);
  }

  async getRatings(
    traktId: string | number,
    type: 'movie' | 'tv'
  ): Promise<TraktRating | null> {
    const endpoint = type === 'tv' ? 'shows' : 'movies';
    return this.makeRequest<TraktRating>(`/${endpoint}/${traktId}/ratings`);
  }

  async getTrending(
    type: 'movie' | 'tv',
    limit: number = 10
  ): Promise<any[] | null> {
    const endpoint = type === 'tv' ? 'shows' : 'movies';
    const clamped = Math.min(Math.max(limit ?? 10, 1), 50);
    if (clamped !== limit) {
      log.info('Trakt getTrending:clamped_limit', {
        requested: limit,
        clamped,
      });
    }
    return this.makeRequest<any[]>(`/${endpoint}/trending?limit=${clamped}`);
  }

  async getPopular(
    type: 'movie' | 'tv',
    limit: number = 10
  ): Promise<any[] | null> {
    const endpoint = type === 'tv' ? 'shows' : 'movies';
    return this.makeRequest<any[]>(`/${endpoint}/popular?limit=${limit}`);
  }

  async getWatchedWeekly(
    type: 'movie' | 'tv',
    limit: number = 10
  ): Promise<any[] | null> {
    const endpoint = type === 'tv' ? 'shows' : 'movies';
    return this.makeRequest<any[]>(
      `/${endpoint}/watched/weekly?limit=${limit}`
    );
  }

  async getPlayedWeekly(
    type: 'movie' | 'tv',
    limit: number = 10
  ): Promise<any[] | null> {
    const endpoint = type === 'tv' ? 'shows' : 'movies';
    return this.makeRequest<any[]>(`/${endpoint}/played/weekly?limit=${limit}`);
  }

  async getCollectedWeekly(
    type: 'movie' | 'tv',
    limit: number = 10
  ): Promise<any[] | null> {
    const endpoint = type === 'tv' ? 'shows' : 'movies';
    return this.makeRequest<any[]>(
      `/${endpoint}/collected/weekly?limit=${limit}`
    );
  }

  async getAnticipated(
    type: 'movie' | 'tv',
    limit: number = 10
  ): Promise<any[] | null> {
    const endpoint = type === 'tv' ? 'shows' : 'movies';
    return this.makeRequest<any[]>(`/${endpoint}/anticipated?limit=${limit}`);
  }

  async getMovieReleases(
    startDateISO: string,
    days: number = 14
  ): Promise<any[] | null> {
    const date = startDateISO.slice(0, 10);
    return this.makeRequest<any[]>(
      `/calendars/all/movies/releases/${date}/${days}`
    );
  }

  async getShowPremieres(
    startDateISO: string,
    days: number = 14
  ): Promise<any[] | null> {
    const date = startDateISO.slice(0, 10);
    return this.makeRequest<any[]>(
      `/calendars/all/shows/premieres/${date}/${days}`
    );
  }

  async getTrendingRank(
    traktId: string | number,
    type: 'movie' | 'tv'
  ): Promise<{ rank: number } | null> {
    const trending = await this.getTrending(type, 100);
    if (!trending) return null;

    const index = trending.findIndex((item) => {
      const content = item[type === 'tv' ? 'show' : 'movie'];
      return content?.ids?.trakt === Number(traktId);
    });

    return index >= 0 ? { rank: index + 1 } : null;
  }

  async searchByTitle(
    title: string,
    year?: string,
    type?: 'movie' | 'tv'
  ): Promise<TraktItem | null> {
    let query = `/search/${type || 'movie,show'}?query=${encodeURIComponent(
      title
    )}`;
    if (year) {
      query += `&years=${year}`;
    }

    const results = await this.makeRequest<TraktSearchResult[]>(query);
    if (!results || results.length === 0) {
      return null;
    }

    // Return the first result's movie or show
    const firstResult = results[0];
    return firstResult.movie || firstResult.show || null;
  }
}
