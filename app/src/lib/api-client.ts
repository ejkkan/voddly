'use client';

import { Env } from '@env';
import { Platform } from 'react-native';

import auth from '@/lib/auth/auth-client';
import Client, { Environment } from '@/lib/encore-client';
// Debug log removed

function normalizeDevHost(url: string): string {
  if (!url) return url;
  if (__DEV__ && Platform.OS === 'android') {
    return url
      .replace('localhost', '10.0.2.2')
      .replace('127.0.0.1', '10.0.2.2');
  }
  return url;
}
// Minimal Encore client wrapper for the app.
// Only exposes the generated services; no custom endpoint helpers here.
class EncoreAPI {
  private readonly client: Client;
  private readonly baseUrl: string;

  constructor(baseURL?: string) {
    const url = normalizeDevHost(baseURL ?? Env.API_URL);
    this.baseUrl = url;
    this.client = new Client(url, {
      requestInit: {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      // Provide cookie from stored better-auth session for Encore auth handler
      auth: () => {
        const cookie = auth.getCookie();
        return cookie ? { cookie } : undefined;
      },
    });
  }

  get raw() {
    return this.client;
  }

  // Generated services
  get auth() {
    return this.client.auth;
  }

  get user() {
    return this.client.user;
  }

  get url() {
    return this.client.url;
  }

  // Custom subtitle endpoints used by the web player
  async extractOriginalSubtitles(params: {
    streamUrl: string;
    movieId: string;
    tmdbId?: number;
  }): Promise<{
    success: boolean;
    tracks?: {
      id: string;
      language_code: string;
      language_name: string;
      source: 'original';
      has_content: boolean;
      trackIndex: number;
      codecId: string;
      format: string;
    }[];
    error?: string;
  }> {
    const res = await fetch(`${this.baseUrl}/subtitles/extract-original`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!res.ok)
      throw new Error(`extractOriginalSubtitles failed: ${res.status}`);
    return res.json();
  }

  async extractOriginalSubtitleContent(params: {
    subtitleId: string;
    streamUrl: string;
    trackIndex: number;
    language: string;
  }): Promise<{
    success: boolean;
    content?: string;
    error?: string;
  }> {
    const res = await fetch(
      `${this.baseUrl}/subtitles/extract-original-content`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      }
    );
    if (!res.ok)
      throw new Error(`extractOriginalSubtitleContent failed: ${res.status}`);
    return res.json();
  }

  async getSubtitleVariants(
    movieId: string,
    languageCode: string,
    params?: { tmdb_id?: number }
  ): Promise<{
    variants: {
      id: string;
      language_code: string;
      language_name: string;
      source: string;
      has_content: boolean;
      name?: string;
      download_count?: number;
      uploader?: string;
    }[];
  }> {
    const url = new URL(
      `${this.baseUrl}/subtitles/${encodeURIComponent(movieId)}/variants/${encodeURIComponent(languageCode)}`
    );
    if (params?.tmdb_id)
      url.searchParams.set('tmdb_id', String(params.tmdb_id));
    const res = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`getSubtitleVariants failed: ${res.status}`);
    return res.json();
  }

  async getSubtitleContentById(variantId: string): Promise<{
    subtitle: {
      id: string;
      language_code: string;
      language_name: string;
      content: string;
      source?: string;
    } | null;
  }> {
    const res = await fetch(
      `${this.baseUrl}/subtitles/variant/${encodeURIComponent(variantId)}/content`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );
    if (!res.ok)
      throw new Error(`getSubtitleContentById failed: ${res.status}`);
    return res.json();
  }

  with(options: Parameters<Client['with']>[0]) {
    return new EncoreAPI().withRaw(this.client.with(options));
  }

  private withRaw(client: Client) {
    const api = Object.create(this) as EncoreAPI;
    // @ts-expect-error reassign private for builder cloning
    api.client = client;
    return api;
  }
}

export const apiClient = new EncoreAPI();
export const createApiClient = (baseURL?: string) => new EncoreAPI(baseURL);
export const createProductionClient = (envName: string) =>
  new EncoreAPI(Environment(envName));

export default apiClient;
