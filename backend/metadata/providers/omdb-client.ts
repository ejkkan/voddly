import { secret } from 'encore.dev/config';
import log from 'encore.dev/log';

const omdbApiKey = secret('OMDBApiKey');

export interface OMDBResponse {
  Title?: string;
  Year?: string;
  Rated?: string;
  Released?: string;
  Runtime?: string;
  Genre?: string;
  Director?: string;
  Writer?: string;
  Actors?: string;
  Plot?: string;
  Language?: string;
  Country?: string;
  Awards?: string;
  Poster?: string;
  Ratings?: Array<{
    Source: string;
    Value: string;
  }>;
  Metascore?: string;
  imdbRating?: string;
  imdbVotes?: string;
  imdbID?: string;
  Type?: string;
  DVD?: string;
  BoxOffice?: string;
  Production?: string;
  Website?: string;
  Response?: string;
  Error?: string;
}

export class OMDBClient {
  private baseUrl = 'http://www.omdbapi.com';
  private apiKey: string | null = null;

  private async getApiKey(): Promise<string> {
    if (!this.apiKey) {
      this.apiKey = await omdbApiKey();
    }
    return this.apiKey;
  }

  async fetchByIMDBId(imdbId: string): Promise<OMDBResponse | null> {
    try {
      const apiKey = await this.getApiKey();
      const url = `${this.baseUrl}/?i=${imdbId}&apikey=${apiKey}&plot=short`;
      
      const response = await fetch(url);
      const data = await response.json() as OMDBResponse;
      
      if (data.Response === 'False') {
        log.warn('OMDB API error', { error: data.Error, imdbId });
        return null;
      }
      
      return data;
    } catch (error) {
      log.error('OMDB fetch failed', { error, imdbId });
      return null;
    }
  }

  async searchByTitle(title: string, year?: string, type?: 'movie' | 'series'): Promise<OMDBResponse | null> {
    try {
      const apiKey = await this.getApiKey();
      let url = `${this.baseUrl}/?t=${encodeURIComponent(title)}&apikey=${apiKey}&plot=short`;
      
      if (year) {
        url += `&y=${year}`;
      }
      
      if (type) {
        url += `&type=${type}`;
      }
      
      const response = await fetch(url);
      const data = await response.json() as OMDBResponse;
      
      if (data.Response === 'False') {
        log.warn('OMDB search failed', { error: data.Error, title, year });
        return null;
      }
      
      return data;
    } catch (error) {
      log.error('OMDB search failed', { error, title });
      return null;
    }
  }
}