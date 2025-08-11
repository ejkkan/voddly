"use client";

import { env } from "../env/client";
import Client, { Environment } from "./encore-client";

/**
 * Enhanced Encore client that automatically handles authentication
 * by reading cookies and providing them to Encore's auth system
 */
class AuthenticatedEncoreClient {
  private client: Client;
  private baseUrl: string;

  constructor(baseURL?: string) {
    // Use provided baseURL or default to Local for development
    const url =
      baseURL ||
      (process.env.NODE_ENV === "production"
        ? Environment("production")
        : env.VITE_ENCORE_API_URL);
    this.baseUrl = url;

    // Create client with auth generator that reads browser cookies
    this.client = new Client(url, {
      requestInit: {
        credentials: "include", // Fallback for other requests
        headers: {
          "Content-Type": "application/json",
        },
      },
      // Auth generator function that reads cookies dynamically
      auth: () => {
        // Get all cookies and pass them to Encore's auth handler
        if (typeof document !== "undefined") {
          const cookies = document.cookie;
          console.log("🍪 Sending cookies to API:", cookies);
          return {
            cookie: cookies, // This passes all cookies to the auth handler
          };
        }
        return undefined;
      },
    });
  }

  /**
   * Get the underlying Encore client for direct access if needed
   */
  get raw() {
    return this.client;
  }

  /**
   * User service methods
   */
  get user() {
    return this.client.user;
  }

  /**
   * Auth service methods
   */
  get auth() {
    return this.client.auth;
  }

  /**
   * Webhooks service methods
   */
  get webhooks() {
    return this.client.webhooks;
  }

  /**
   * URL service methods
   */
  get url() {
    return this.client.url;
  }

  /**
   * Create a new client instance with different configuration
   */
  with(options: Parameters<Client["with"]>[0]) {
    return new AuthenticatedEncoreClient().withRawClient(this.client.with(options));
  }

  private withRawClient(client: Client) {
    const newInstance = Object.create(this);
    newInstance.client = client;
    return newInstance;
  }

  // ==============================
  // Custom endpoints (raw fetch)
  // ==============================
  async createAccount(body: { name?: string }) {
    const res = await fetch(`${this.baseUrl}/accounts`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`createAccount failed: ${res.status}`);
    return res.json();
  }

  async listAccounts() {
    const res = await fetch(`${this.baseUrl}/accounts`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) throw new Error(`listAccounts failed: ${res.status}`);
    return res.json();
  }

  async upsertAccountKeyWrap(
    accountId: string,
    body: {
      wrapped_avk: string;
      kdf_algo?: string | null;
      kdf_salt?: string | null;
      kdf_params?: any | null;
      wrap_algo: string;
    },
  ) {
    const res = await fetch(`${this.baseUrl}/accounts/${accountId}/key-wrap`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`upsertAccountKeyWrap failed: ${res.status}`);
    return res.json();
  }

  async getMyKeyWrap(accountId: string) {
    const res = await fetch(`${this.baseUrl}/accounts/${accountId}/key-wrap`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) throw new Error(`getMyKeyWrap failed: ${res.status}`);
    return res.json();
  }

  async createAccountSecret(
    accountId: string,
    body: {
      type: string;
      name?: string | null;
      ciphertext: string;
      nonce: string;
      wrapped_dek: string;
      wrapped_dek_nonce: string;
      cipher_algo: string;
      version?: number;
    },
  ) {
    const res = await fetch(`${this.baseUrl}/accounts/${accountId}/secrets`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`createAccountSecret failed: ${res.status}`);
    return res.json();
  }

  async getAccountSecret(accountId: string, secretId: string) {
    const res = await fetch(`${this.baseUrl}/accounts/${accountId}/secrets/${secretId}`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) throw new Error(`getAccountSecret failed: ${res.status}`);
    return res.json();
  }

  async createAccountSource(
    accountId: string,
    body: {
      provider_type: string;
      label: string;
      secret_id?: string | null;
      priority?: number;
    },
  ) {
    const res = await fetch(`${this.baseUrl}/accounts/${accountId}/sources`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`createAccountSource failed: ${res.status}`);
    return res.json();
  }

  async listAccountSources(accountId: string) {
    const res = await fetch(`${this.baseUrl}/accounts/${accountId}/sources`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) throw new Error(`listAccountSources failed: ${res.status}`);
    return res.json();
  }

  async upsertContentState(body: {
    accountId: string;
    contentKey: string;
    lastPositionSeconds?: number | null;
    isFavorite?: boolean | null;
  }) {
    const res = await fetch(`${this.baseUrl}/user/content-state`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`upsertContentState failed: ${res.status}`);
    return res.json();
  }

  async getContentState(body: { accountId: string; contentKeys: string[] }) {
    const res = await fetch(`${this.baseUrl}/user/content-state/query`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`getContentState failed: ${res.status}`);
    return res.json();
  }

  /**
   * Get detailed series information from Xtream source
   */
  async getSeriesDetails(body: {
    server: string;
    username: string;
    password: string;
    seriesId: number;
  }) {
    const res = await fetch(`${this.baseUrl}/xtream/series`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`getSeriesDetails failed: ${res.status}`);
    return res.json();
  }

  /**
   * Extract MKV subtitle track via backend (legacy)
   */
  async extractMKVSubtitle(params: {
    streamUrl: string;
    language: string;
    trackIndex: number;
    codecId: string;
  }) {
    const res = await fetch(`${this.baseUrl}/subtitles/mkv-extract`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        cookie: document?.cookie || "",
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      throw new Error(`MKV extraction failed: ${res.status}`);
    }

    return res.json();
  }

  /**
   * Extract all original subtitle tracks from video stream
   */
  async extractOriginalSubtitles(params: {
    streamUrl: string;
    movieId: string;
    tmdbId?: number;
  }) {
    const res = await fetch(`${this.baseUrl}/subtitles/extract-original`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      throw new Error(`Original subtitle extraction failed: ${res.status}`);
    }

    return res.json();
  }

  /**
   * Extract specific original subtitle content
   */
  async extractOriginalSubtitleContent(params: {
    subtitleId: string;
    streamUrl: string;
    trackIndex: number;
    language: string;
  }) {
    const res = await fetch(`${this.baseUrl}/subtitles/extract-original-content`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      throw new Error(`Original subtitle content extraction failed: ${res.status}`);
    }

    return res.json();
  }
}

// Create singleton instances for different environments
export const apiClient = new AuthenticatedEncoreClient();
export const createApiClient = (baseURL?: string) =>
  new AuthenticatedEncoreClient(baseURL);

// For production, you might want to use Environment
export const createProductionClient = (envName: string) =>
  new AuthenticatedEncoreClient(Environment(envName));

export default apiClient;
