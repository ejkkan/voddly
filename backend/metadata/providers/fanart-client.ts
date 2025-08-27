import { secret } from 'encore.dev/config';
import log from 'encore.dev/log';

const fanartApiKey = secret('FanArtApiKey');

export interface FanArtImage {
  id: string;
  url: string;
  lang: string;
  likes: string;
  season?: string;
  disc?: string;
  disc_type?: string;
}

export interface FanArtResponse {
  name?: string;
  tmdb_id?: string;
  imdb_id?: string;
  
  // Movie artwork
  hdmovielogo?: FanArtImage[];
  movielogo?: FanArtImage[];
  hdmovieclearart?: FanArtImage[];
  movieart?: FanArtImage[];
  moviedisc?: FanArtImage[];
  movieposter?: FanArtImage[];
  moviebackground?: FanArtImage[];
  moviebanner?: FanArtImage[];
  moviethumb?: FanArtImage[];
  
  // TV artwork
  hdtvlogo?: FanArtImage[];
  clearlogo?: FanArtImage[];
  hdclearart?: FanArtImage[];
  clearart?: FanArtImage[];
  showbackground?: FanArtImage[];
  tvthumb?: FanArtImage[];
  tvposter?: FanArtImage[];
  tvbanner?: FanArtImage[];
  seasonposter?: FanArtImage[];
  seasonthumb?: FanArtImage[];
  seasonbanner?: FanArtImage[];
  characterart?: FanArtImage[];
}

export class FanArtClient {
  private baseUrl = 'http://webservice.fanart.tv/v3';
  private apiKey: string | null = null;

  private async getApiKey(): Promise<string> {
    if (!this.apiKey) {
      this.apiKey = await fanartApiKey();
    }
    return this.apiKey;
  }

  async getArtwork(tmdbId: number, type: 'movie' | 'tv'): Promise<FanArtResponse | null> {
    try {
      const apiKey = await this.getApiKey();
      const endpoint = type === 'tv' ? 'tv' : 'movies';
      const url = `${this.baseUrl}/${endpoint}/${tmdbId}?api_key=${apiKey}`;
      const start = Date.now();
      log.debug('FanArt request start', { url, tmdbId, type });
      const response = await fetch(url);
      const durationMs = Date.now() - start;
      
      if (!response.ok) {
        if (response.status === 404) {
          // No artwork found for this content
          return null;
        }
        log.warn('FanArt API error', { status: response.status, tmdbId, type, durationMs });
        return null;
      }
      log.debug('FanArt request done', { tmdbId, type, status: response.status, durationMs });
      const data = await response.json() as FanArtResponse;
      return data;
    } catch (error) {
      log.error('FanArt fetch failed', { error, tmdbId, type });
      return null;
    }
  }

  getBestArtwork(artwork: FanArtResponse | null, type: 'movie' | 'tv'): {
    logo_url?: string;
    clearart_url?: string;
    banner_url?: string;
    thumb_url?: string;
    disc_url?: string;
    poster_url?: string;
    background_url?: string;
  } {
    if (!artwork) return {};

    const result: any = {};

    if (type === 'movie') {
      // Get best logo (HD preferred)
      const logo = artwork.hdmovielogo?.[0] || artwork.movielogo?.[0];
      if (logo) result.logo_url = logo.url;

      // Get best clearart (HD preferred)
      const clearart = artwork.hdmovieclearart?.[0] || artwork.movieart?.[0];
      if (clearart) result.clearart_url = clearart.url;

      // Get banner
      if (artwork.moviebanner?.[0]) {
        result.banner_url = artwork.moviebanner[0].url;
      }

      // Get thumb
      if (artwork.moviethumb?.[0]) {
        result.thumb_url = artwork.moviethumb[0].url;
      }

      // Get disc art
      if (artwork.moviedisc?.[0]) {
        result.disc_url = artwork.moviedisc[0].url;
      }

      // Get poster
      if (artwork.movieposter?.[0]) {
        result.poster_url = artwork.movieposter[0].url;
      }

      // Get background
      if (artwork.moviebackground?.[0]) {
        result.background_url = artwork.moviebackground[0].url;
      }
    } else {
      // TV Show artwork
      const logo = artwork.hdtvlogo?.[0] || artwork.clearlogo?.[0];
      if (logo) result.logo_url = logo.url;

      const clearart = artwork.hdclearart?.[0] || artwork.clearart?.[0];
      if (clearart) result.clearart_url = clearart.url;

      if (artwork.tvbanner?.[0]) {
        result.banner_url = artwork.tvbanner[0].url;
      }

      if (artwork.tvthumb?.[0]) {
        result.thumb_url = artwork.tvthumb[0].url;
      }

      if (artwork.tvposter?.[0]) {
        result.poster_url = artwork.tvposter[0].url;
      }

      if (artwork.showbackground?.[0]) {
        result.background_url = artwork.showbackground[0].url;
      }
    }

    return result;
  }
}