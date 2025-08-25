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

  private async makeRequest<T>(endpoint: string): Promise<T | null> {
    try {
      const clientId = await this.getClientId();
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          'trakt-api-version': '2',
          'trakt-api-key': clientId
        }
      });

      if (!response.ok) {
        log.warn('Trakt API error', { status: response.status, endpoint });
        return null;
      }

      return await response.json() as T;
    } catch (error) {
      log.error('Trakt request failed', { error, endpoint });
      return null;
    }
  }

  async getByTMDBId(tmdbId: number, type: 'movie' | 'tv'): Promise<TraktItem | null> {
    const traktType = type === 'tv' ? 'show' : 'movie';
    const results = await this.makeRequest<TraktSearchResult[]>(
      `/search/tmdb/${tmdbId}?type=${traktType}`
    );

    if (!results || results.length === 0) {
      return null;
    }

    return results[0][traktType] || null;
  }

  async getStats(traktId: string | number, type: 'movie' | 'tv'): Promise<TraktStats | null> {
    const endpoint = type === 'tv' ? 'shows' : 'movies';
    return this.makeRequest<TraktStats>(`/${endpoint}/${traktId}/stats`);
  }

  async getRatings(traktId: string | number, type: 'movie' | 'tv'): Promise<TraktRating | null> {
    const endpoint = type === 'tv' ? 'shows' : 'movies';
    return this.makeRequest<TraktRating>(`/${endpoint}/${traktId}/ratings`);
  }

  async getTrending(type: 'movie' | 'tv', limit: number = 10): Promise<any[] | null> {
    const endpoint = type === 'tv' ? 'shows' : 'movies';
    return this.makeRequest<any[]>(`/${endpoint}/trending?limit=${limit}`);
  }

  async getTrendingRank(traktId: string | number, type: 'movie' | 'tv'): Promise<{ rank: number } | null> {
    const trending = await this.getTrending(type, 100);
    if (!trending) return null;

    const index = trending.findIndex(item => {
      const content = item[type === 'tv' ? 'show' : 'movie'];
      return content?.ids?.trakt === Number(traktId);
    });

    return index >= 0 ? { rank: index + 1 } : null;
  }

  async searchByTitle(title: string, year?: string, type?: 'movie' | 'tv'): Promise<TraktItem | null> {
    let query = `/search/${type || 'movie,show'}?query=${encodeURIComponent(title)}`;
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