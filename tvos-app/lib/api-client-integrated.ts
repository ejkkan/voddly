/**
 * Integrated API client for tvOS that uses Encore client with secure auth
 */

import Client from './encore-client';
import { authManager } from './auth-manager';
import { getDeviceId } from './device-id';
import { getDeviceType } from './crypto-utils-secure';
import { 
  RegisterDeviceRequest,
  RegisterDeviceResponse,
  CheckDeviceRequest,
  CheckDeviceResponse,
  GetDeviceKeyRequest,
  GetDeviceKeyResponse,
  SetupPassphraseRequest,
  SetupPassphraseResponse,
  HealthCheckResponse
} from './types';

// API configuration
const API_CONFIG = {
  LOCAL_URL: 'http://localhost:4000',
  STAGING_URL: 'https://staging-iptvtest-gibi.encr.app',
  PRODUCTION_URL: 'https://production-iptvtest-gibi.encr.app',
  DEFAULT_TIMEOUT: 30000,
  MAX_RETRIES: 3,
} as const;

// Environment detection
function getApiUrl(): string {
  // In a real app, this would be configured via environment variables
  if (__DEV__) {
    return API_CONFIG.LOCAL_URL;
  }
  return API_CONFIG.PRODUCTION_URL;
}

export class IntegratedAPIClient {
  private client: Client;
  private deviceId: string | null = null;

  constructor() {
    const baseUrl = getApiUrl();
    
    this.client = new Client(baseUrl, {
      requestInit: {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      auth: async () => {
        // Get auth token from auth manager
        const token = authManager.getAuthToken();
        const deviceId = await this.getDeviceId();

        if (token || deviceId) {
          return {
            cookie: token || '',
            deviceId: deviceId || undefined,
          } as any;
        }
        return undefined;
      },
    });

    console.log('[IntegratedAPI] Initialized with base URL:', baseUrl);
  }

  private async getDeviceId(): Promise<string> {
    if (!this.deviceId) {
      this.deviceId = await getDeviceId();
    }
    return this.deviceId;
  }

  /**
   * Authentication endpoints
   */
  async login(email: string, password: string) {
    return authManager.login(email, password);
  }

  async logout() {
    return authManager.logout();
  }

  async refreshToken() {
    return authManager.refreshToken();
  }

  /**
   * Device management endpoints
   */
  async checkDevice(accountId: string): Promise<CheckDeviceResponse> {
    const deviceId = await this.getDeviceId();
    
    try {
      const result = await this.client.user.checkDevice({
        accountId,
        deviceId,
      });

      return {
        isRegistered: result.isRegistered,
        requiresPassphrase: result.requiresPassphrase,
        canAutoRegister: result.canAutoRegister,
        deviceCount: result.deviceCount,
        maxDevices: result.maxDevices,
        message: result.message,
      };
    } catch (error) {
      console.error('[IntegratedAPI] Check device failed:', error);
      throw error;
    }
  }

  async registerDevice(
    accountId: string,
    passphrase: string,
    deviceName?: string,
    deviceModel?: string
  ): Promise<RegisterDeviceResponse> {
    const deviceId = await this.getDeviceId();
    const deviceType = getDeviceType();

    try {
      const result = await this.client.user.registerDevice({
        accountId,
        deviceId,
        deviceType,
        deviceName,
        deviceModel,
        passphrase,
      });

      return {
        success: result.success,
        deviceId: result.deviceId,
        iterations: result.iterations,
        keyData: result.keyData,
      };
    } catch (error) {
      console.error('[IntegratedAPI] Register device failed:', error);
      throw error;
    }
  }

  async getDeviceKey(accountId: string): Promise<GetDeviceKeyResponse> {
    const deviceId = await this.getDeviceId();

    try {
      const result = await this.client.user.getDeviceKey({
        accountId,
        deviceId,
      });

      return {
        keyData: result.keyData,
      };
    } catch (error) {
      console.error('[IntegratedAPI] Get device key failed:', error);
      throw error;
    }
  }

  async removeDevice(accountId: string, deviceId?: string): Promise<{ success: boolean }> {
    const targetDeviceId = deviceId || await this.getDeviceId();

    try {
      const result = await this.client.user.removeDevice({
        accountId,
        deviceId: targetDeviceId,
      });

      return { success: result.success };
    } catch (error) {
      console.error('[IntegratedAPI] Remove device failed:', error);
      throw error;
    }
  }

  async listDevices(accountId: string) {
    try {
      return await this.client.user.listDevices({ accountId });
    } catch (error) {
      console.error('[IntegratedAPI] List devices failed:', error);
      throw error;
    }
  }

  /**
   * Passphrase management endpoints
   */
  async setupPassphrase(
    passphrase: string,
    deviceName?: string,
    deviceModel?: string
  ): Promise<SetupPassphraseResponse> {
    const deviceId = await this.getDeviceId();
    const deviceType = getDeviceType();

    try {
      const result = await this.client.user.setupPassphrase({
        passphrase,
        deviceId,
        deviceType,
        deviceName,
        deviceModel,
      });

      return { success: result.success };
    } catch (error) {
      console.error('[IntegratedAPI] Setup passphrase failed:', error);
      throw error;
    }
  }

  /**
   * User content endpoints
   */
  async getSources(): Promise<{
    sources: any[];
    keyData?: {
      master_key_wrapped: string;
      salt: string;
      iv: string;
      kdf_iterations: number;
    };
  }> {
    try {
      const result = await this.client.user.getSources({});
      
      return {
        sources: result.sources || [],
        keyData: result.keyData,
      };
    } catch (error) {
      console.error('[IntegratedAPI] Get sources failed:', error);
      throw error;
    }
  }

  async addSource(sourceData: {
    name: string;
    type: 'iptv' | 'file' | 'stream';
    url: string;
    credentials?: {
      username: string;
      password: string;
    };
  }) {
    try {
      return await this.client.user.addSource(sourceData);
    } catch (error) {
      console.error('[IntegratedAPI] Add source failed:', error);
      throw error;
    }
  }

  async updateSource(sourceId: string, updates: any) {
    try {
      return await this.client.user.updateSource({
        sourceId,
        ...updates,
      });
    } catch (error) {
      console.error('[IntegratedAPI] Update source failed:', error);
      throw error;
    }
  }

  async removeSource(sourceId: string) {
    try {
      return await this.client.user.removeSource({ sourceId });
    } catch (error) {
      console.error('[IntegratedAPI] Remove source failed:', error);
      throw error;
    }
  }

  /**
   * Metadata endpoints
   */
  async getMetadata(params: {
    tmdbId?: number;
    title?: string;
    contentType: 'movie' | 'tv' | 'season' | 'episode';
    seasonNumber?: number;
    episodeNumber?: number;
    forceRefresh?: boolean;
  }) {
    try {
      if (params.tmdbId) {
        return await this.client.user.getMetadataForContent({
          tmdb_id: params.tmdbId,
          content_type: params.contentType,
          season_number: params.seasonNumber,
          episode_number: params.episodeNumber,
          force_refresh: params.forceRefresh,
        });
      } else if (params.title) {
        // Use metadata service for title-based search
        return await this.client.metadata.searchByTitle({
          title: params.title,
          content_type: params.contentType,
          season_number: params.seasonNumber,
          episode_number: params.episodeNumber,
        });
      } else {
        throw new Error('Either tmdbId or title must be provided');
      }
    } catch (error) {
      console.error('[IntegratedAPI] Get metadata failed:', error);
      throw error;
    }
  }

  /**
   * Health and system endpoints
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    try {
      // Use a simple endpoint to check health
      const result = await this.client.user.getSources({});
      
      return {
        status: 'healthy',
        timestamp: Date.now(),
        services: {
          user: 'healthy',
          auth: authManager.isAuthenticated() ? 'healthy' : 'degraded',
        },
      };
    } catch (error) {
      console.error('[IntegratedAPI] Health check failed:', error);
      
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        services: {
          user: 'unhealthy',
          auth: authManager.isAuthenticated() ? 'healthy' : 'unhealthy',
        },
      };
    }
  }

  /**
   * Get the underlying Encore client for advanced usage
   */
  getEncoreClient(): Client {
    return this.client;
  }

  /**
   * Update API base URL (for environment switching)
   */
  updateBaseUrl(baseUrl: string): void {
    this.client = new Client(baseUrl, this.client.options);
    console.log('[IntegratedAPI] Base URL updated to:', baseUrl);
  }

  /**
   * Get current API configuration
   */
  getConfig() {
    return {
      baseUrl: this.client.target,
      deviceId: this.deviceId,
      isAuthenticated: authManager.isAuthenticated(),
      currentUser: authManager.getCurrentUser(),
    };
  }
}

// Export singleton instance
export const integratedApiClient = new IntegratedAPIClient();
export default integratedApiClient;