'use client';

/**
 * API client for tvOS app to communicate with Voddly backend
 * Simplified version focused on device registration and passphrase validation
 */

import { getDeviceType } from './crypto-utils';
import { getDeviceId } from './device-id';

// API endpoints
interface RegisterDeviceRequest {
  accountId: string;
  deviceId: string;
  deviceType: 'tvos';
  deviceName?: string;
  deviceModel?: string;
  passphrase: string;
}

interface RegisterDeviceResponse {
  success: boolean;
  deviceId: string;
  iterations: number;
  keyData: {
    master_key_wrapped: string;
    salt: string;
    iv: string;
    kdf_iterations: number;
    server_wrapped_key?: string;
    server_iv?: string;
  };
}

interface CheckDeviceRequest {
  accountId: string;
  deviceId: string;
}

interface CheckDeviceResponse {
  isRegistered: boolean;
  requiresPassphrase: boolean;
  canAutoRegister?: boolean;
  deviceCount?: number;
  maxDevices?: number;
  message?: string;
}

interface GetDeviceKeyRequest {
  accountId: string;
  deviceId: string;
}

interface GetDeviceKeyResponse {
  keyData: {
    master_key_wrapped: string;
    salt: string;
    iv: string;
    kdf_iterations: number;
    server_wrapped_key?: string;
    server_iv?: string;
  };
}

class TVOSApiClient {
  private baseUrl: string;
  private deviceId: string | null = null;

  constructor(baseUrl: string = 'http://localhost:4000') {
    this.baseUrl = baseUrl;
  }

  private async getDeviceId(): Promise<string> {
    if (!this.deviceId) {
      this.deviceId = await getDeviceId();
    }
    return this.deviceId;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST';
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;
    
    const deviceId = await this.getDeviceId();
    
    const requestHeaders = {
      'Content-Type': 'application/json',
      'X-Device-Id': deviceId,
      ...headers,
    };

    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    console.log(`[API] ${method} ${endpoint}`, { body, headers: requestHeaders });

    const response = await fetch(`${this.baseUrl}${endpoint}`, requestOptions);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] Request failed: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`[API] Response:`, result);
    return result;
  }

  /**
   * Check if device is registered for an account
   */
  async checkDevice(accountId: string): Promise<CheckDeviceResponse> {
    const deviceId = await this.getDeviceId();
    return this.makeRequest<CheckDeviceResponse>('/user/check-device', {
      method: 'POST',
      body: { accountId, deviceId },
    });
  }

  /**
   * Register device with passphrase
   */
  async registerDevice(
    accountId: string,
    passphrase: string,
    deviceName?: string,
    deviceModel?: string
  ): Promise<RegisterDeviceResponse> {
    const deviceId = await this.getDeviceId();
    const deviceType = getDeviceType();

    return this.makeRequest<RegisterDeviceResponse>('/user/register-device', {
      method: 'POST',
      body: {
        accountId,
        deviceId,
        deviceType,
        deviceName,
        deviceModel,
        passphrase,
      } as RegisterDeviceRequest,
    });
  }

  /**
   * Get device-specific encryption key data
   */
  async getDeviceKey(accountId: string): Promise<GetDeviceKeyResponse> {
    const deviceId = await this.getDeviceId();
    return this.makeRequest<GetDeviceKeyResponse>('/user/get-device-key', {
      method: 'POST',
      body: { accountId, deviceId } as GetDeviceKeyRequest,
    });
  }

  /**
   * Setup initial passphrase for account (one-time setup)
   */
  async setupPassphrase(
    passphrase: string,
    deviceName?: string,
    deviceModel?: string
  ): Promise<{ success: boolean }> {
    const deviceId = await this.getDeviceId();
    const deviceType = getDeviceType();

    return this.makeRequest<{ success: boolean }>('/account/setup-passphrase', {
      method: 'POST',
      body: {
        passphrase,
        deviceId,
        deviceType,
        deviceName,
        deviceModel,
      },
    });
  }
}

// Export singleton instance
export const apiClient = new TVOSApiClient();
export default apiClient;