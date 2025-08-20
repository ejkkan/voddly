import { ContentType, TMDBConfig, TMDBMovieDetails, TMDBTVDetails, TMDBSearchResult } from './types';

export class TMDBClient {
  private config: TMDBConfig;
  private baseUrl: string;

  constructor(config: TMDBConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.themoviedb.org/3';
  }

  private async makeRequest<T>(path: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ status_message: 'Unknown error' }));
      throw new Error(`TMDB API error: ${error.status_message || response.statusText}`);
    }

    return response.json();
  }

  async getMovieDetails(
    movieId: number,
    appendToResponse?: string
  ): Promise<TMDBMovieDetails> {
    const params: Record<string, any> = {};
    if (appendToResponse) {
      params.append_to_response = appendToResponse;
    }

    return this.makeRequest<TMDBMovieDetails>(
      `/movie/${movieId}`,
      params
    );
  }

  async getTVDetails(
    tvId: number,
    appendToResponse?: string
  ): Promise<TMDBTVDetails> {
    const params: Record<string, any> = {};
    if (appendToResponse) {
      params.append_to_response = appendToResponse;
    }

    return this.makeRequest<TMDBTVDetails>(
      `/tv/${tvId}`,
      params
    );
  }

  async getSeasonDetails(
    tvId: number,
    seasonNumber: number,
    appendToResponse?: string
  ): Promise<any> {
    const params: Record<string, any> = {};
    if (appendToResponse) {
      params.append_to_response = appendToResponse;
    }

    return this.makeRequest<any>(
      `/tv/${tvId}/season/${seasonNumber}`,
      params
    );
  }

  async getEpisodeDetails(
    tvId: number,
    seasonNumber: number,
    episodeNumber: number,
    appendToResponse?: string
  ): Promise<any> {
    const params: Record<string, any> = {};
    if (appendToResponse) {
      params.append_to_response = appendToResponse;
    }

    return this.makeRequest<any>(
      `/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`,
      params
    );
  }

  async searchMovies(
    query: string,
    year?: number,
    page?: number,
    language?: string
  ): Promise<TMDBSearchResult> {
    return this.makeRequest<TMDBSearchResult>('/search/movie', {
      query,
      year,
      page: page || 1,
      language: language || 'en-US',
    });
  }

  async searchTV(
    query: string,
    year?: number,
    page?: number,
    language?: string
  ): Promise<TMDBSearchResult> {
    return this.makeRequest<TMDBSearchResult>('/search/tv', {
      query,
      first_air_date_year: year,
      page: page || 1,
      language: language || 'en-US',
    });
  }

  async searchMulti(
    query: string,
    page?: number,
    language?: string
  ): Promise<TMDBSearchResult> {
    return this.makeRequest<TMDBSearchResult>('/search/multi', {
      query,
      page: page || 1,
      language: language || 'en-US',
    });
  }

  async getMovieVideos(movieId: number): Promise<any> {
    return this.makeRequest<any>(`/movie/${movieId}/videos`);
  }

  async getTVVideos(tvId: number): Promise<any> {
    return this.makeRequest<any>(`/tv/${tvId}/videos`);
  }

  async getMovieImages(movieId: number): Promise<any> {
    return this.makeRequest<any>(`/movie/${movieId}/images`);
  }

  async getTVImages(tvId: number): Promise<any> {
    return this.makeRequest<any>(`/tv/${tvId}/images`);
  }

  async getMovieCredits(movieId: number): Promise<any> {
    return this.makeRequest<any>(`/movie/${movieId}/credits`);
  }

  async getTVCredits(tvId: number): Promise<any> {
    return this.makeRequest<any>(`/tv/${tvId}/credits`);
  }

  async getMovieKeywords(movieId: number): Promise<any> {
    return this.makeRequest<any>(`/movie/${movieId}/keywords`);
  }

  async getTVKeywords(tvId: number): Promise<any> {
    return this.makeRequest<any>(`/tv/${tvId}/keywords`);
  }

  async getMovieExternalIds(movieId: number): Promise<any> {
    return this.makeRequest<any>(`/movie/${movieId}/external_ids`);
  }

  async getTVExternalIds(tvId: number): Promise<any> {
    return this.makeRequest<any>(`/tv/${tvId}/external_ids`);
  }
}