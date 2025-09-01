'use client';

/**
 * Secure API client for tvOS app - Addresses security concerns
 * Sanitizes error messages and implements proper error handling
 */

import { getDeviceType } from './crypto-utils-secure';
import { getDeviceId } from './device-id';

// Error handling configuration
const ERROR_CONFIG = {
  SANITIZE_ERRORS: true,
  LOG_DETAILED_ERRORS: true,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  REQUEST_TIMEOUT_MS: 30000,
} as const;

// Sanitized error messages for users
const USER_FRIENDLY_ERRORS = {
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection and try again.',
  AUTHENTICATION_ERROR: 'Authentication failed. Please check your credentials.',
  AUTHORIZATION_ERROR: 'You do not have permission to access this resource.',
  VALIDATION_ERROR: 'The provided information is invalid. Please check your input.',
  SERVER_ERROR: 'A server error occurred. Please try again later.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const;

// API endpoint interfaces
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

interface AuthResponse {
  token?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: {
    id: string;
    email?: string;
    subscription?: {
      id: string;
      status: string;
    };
  };
}

// Custom error classes
export class APIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class NetworkError extends APIError {
  constructor(message: string, originalError?: Error) {
    super(message, 'NETWORK_ERROR', undefined, originalError);
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string, status: number) {
    super(message, 'AUTHENTICATION_ERROR', status);
  }
}

export class ValidationError extends APIError {
  constructor(message: string, status: number) {
    super(message, 'VALIDATION_ERROR', status);
  }
}

class SecureAPIClient {
  private baseUrl: string;
  private deviceId: string | null = null;
  private authToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor(baseUrl: string = 'http://localhost:4000') {
    this.baseUrl = baseUrl;
  }

  private async getDeviceId(): Promise<string> {
    if (!this.deviceId) {
      this.deviceId = await getDeviceId();
    }
    return this.deviceId;
  }

  /**
   * Sanitize error messages for user display
   */
  private sanitizeError(error: any, status?: number): APIError {
    if (ERROR_CONFIG.LOG_DETAILED_ERRORS) {
      console.error('[SecureAPI] Detailed error:', error);
    }

    if (!ERROR_CONFIG.SANITIZE_ERRORS) {
      return new APIError(error.message || 'Unknown error', 'UNKNOWN_ERROR', status, error);
    }

    // Map HTTP status codes to user-friendly messages
    if (status) {
      switch (Math.floor(status / 100)) {
        case 4:
          if (status === 401) {
            return new AuthenticationError(USER_FRIENDLY_ERRORS.AUTHENTICATION_ERROR, status);
          } else if (status === 403) {
            return new APIError(USER_FRIENDLY_ERRORS.AUTHORIZATION_ERROR, 'AUTHORIZATION_ERROR', status);
          } else if (status === 400 || status === 422) {
            return new ValidationError(USER_FRIENDLY_ERRORS.VALIDATION_ERROR, status);
          }
          break;
        case 5:
          return new APIError(USER_FRIENDLY_ERRORS.SERVER_ERROR, 'SERVER_ERROR', status);
      }
    }

    // Check for network-related errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new NetworkError(USER_FRIENDLY_ERRORS.NETWORK_ERROR, error);
    }

    if (error.name === 'AbortError') {
      return new APIError(USER_FRIENDLY_ERRORS.TIMEOUT_ERROR, 'TIMEOUT_ERROR', undefined, error);
    }

    return new APIError(USER_FRIENDLY_ERRORS.UNKNOWN_ERROR, 'UNKNOWN_ERROR', status, error);
  }

  /**
   * Make secure HTTP request with retry logic and error handling
   */
  private async makeRequest<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      headers?: Record<string, string>;
      requireAuth?: boolean;
      retryAttempts?: number;
    } = {}
  ): Promise<T> {
    const {
      method = 'GET',
      body,
      headers = {},
      requireAuth = false,
      retryAttempts = ERROR_CONFIG.MAX_RETRY_ATTEMPTS,
    } = options;

    const deviceId = await this.getDeviceId();

    // Prepare headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Device-Id': deviceId,
      'X-Device-Type': getDeviceType(),
      'X-Client-Version': '1.0.0',
      ...headers,
    };

    // Add authentication if required and available
    if (requireAuth && this.authToken) {
      requestHeaders.Authorization = `Bearer ${this.authToken}`;
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      signal: AbortSignal.timeout(ERROR_CONFIG.REQUEST_TIMEOUT_MS),
    };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    let lastError: Error;

    // Retry logic
    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        console.log(`[SecureAPI] ${method} ${endpoint} (attempt ${attempt + 1}/${retryAttempts + 1})`);

        const response = await fetch(`${this.baseUrl}${endpoint}`, requestOptions);

        // Handle authentication errors
        if (response.status === 401 && this.refreshToken && requireAuth) {
          const refreshed = await this.refreshAuthToken();
          if (refreshed) {
            // Retry with new token
            requestHeaders.Authorization = `Bearer ${this.authToken}`;
            continue;
          }
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw this.sanitizeError({ message: errorText }, response.status);
        }

        const result = await response.json();
        console.log(`[SecureAPI] Request successful: ${endpoint}`);
        return result;
      } catch (error: any) {
        lastError = error;

        // Don't retry on authentication or validation errors
        if (error instanceof AuthenticationError || error instanceof ValidationError) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === retryAttempts) {
          break;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, ERROR_CONFIG.RETRY_DELAY_MS * (attempt + 1)));
        console.warn(`[SecureAPI] Retrying request to ${endpoint} (attempt ${attempt + 2})`);
      }
    }

    throw this.sanitizeError(lastError!);
  }

  /**
   * Authenticate with the API
   */
  async authenticate(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await this.makeRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      if (response.token) {
        this.authToken = response.token;
        this.refreshToken = response.refreshToken || null;
        this.tokenExpiry = response.expiresIn ? Date.now() + (response.expiresIn * 1000) : null;
      }

      return response;
    } catch (error) {
      console.error('[SecureAPI] Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshAuthToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await this.makeRequest<AuthResponse>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: this.refreshToken },
      });

      if (response.token) {
        this.authToken = response.token;
        this.refreshToken = response.refreshToken || this.refreshToken;
        this.tokenExpiry = response.expiresIn ? Date.now() + (response.expiresIn * 1000) : null;
        return true;
      }
    } catch (error) {
      console.error('[SecureAPI] Token refresh failed:', error);
      this.clearAuth();
    }

    return false;
  }

  /**
   * Clear authentication data
   */
  clearAuth(): void {
    this.authToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Check if device is registered for an account
   */
  async checkDevice(accountId: string): Promise<CheckDeviceResponse> {
    const deviceId = await this.getDeviceId();
    return this.makeRequest<CheckDeviceResponse>('/user/check-device', {
      method: 'POST',
      body: { accountId, deviceId },
      requireAuth: true,
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
      requireAuth: true,
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
      requireAuth: true,
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
      requireAuth: true,
    });
  }

  /**
   * Get user sources with encryption data
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
    return this.makeRequest('/user/sources', {
      method: 'GET',
      requireAuth: true,
    });
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string; timestamp: number }> {
    return this.makeRequest('/health', {
      method: 'GET',
      retryAttempts: 1,
    });
  }
}

// Export singleton instance
export const secureApiClient = new SecureAPIClient();
export default secureApiClient;