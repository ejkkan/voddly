'use client';

import { Env } from '@env';

import auth from '@/lib/auth/auth-client';
import Client, { Environment } from '@/lib/encore-client';
console.log('Env', Env.API_URL);
// Minimal Encore client wrapper for the app.
// Only exposes the generated services; no custom endpoint helpers here.
class EncoreAPI {
  private readonly client: Client;

  constructor() {
    console.log('Env', Env);
    const url = Env.API_URL;

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
