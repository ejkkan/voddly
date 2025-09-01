/**
 * Authentication manager for tvOS app
 * Handles login, token management, and session persistence
 */

import { secureStorage } from './secure-storage';
import { secureApiClient } from './api-client-secure';
import { validateEmail } from './validation';
import { AuthRequest, AuthResponse } from './types';

// Auth configuration
const AUTH_CONFIG = {
  TOKEN_STORAGE_KEY: 'auth_token',
  REFRESH_TOKEN_STORAGE_KEY: 'refresh_token',
  USER_STORAGE_KEY: 'user_data',
  TOKEN_EXPIRY_BUFFER_MS: 5 * 60 * 1000, // 5 minutes buffer before expiry
  MAX_RETRY_ATTEMPTS: 3,
  AUTO_REFRESH_ENABLED: true,
} as const;

// Auth state interface
interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
  user: {
    id: string;
    email?: string;
    subscription?: {
      id: string;
      status: string;
    };
  } | null;
}

// Auth events
export type AuthEventType = 'login' | 'logout' | 'token_refreshed' | 'auth_error';

export interface AuthEvent {
  type: AuthEventType;
  timestamp: number;
  data?: unknown;
}

export type AuthEventListener = (event: AuthEvent) => void;

export class AuthManagerError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'AuthManagerError';
  }
}

export class AuthManager {
  private static instance: AuthManager | null = null;
  private authState: AuthState = {
    isAuthenticated: false,
    token: null,
    refreshToken: null,
    tokenExpiry: null,
    user: null,
  };
  private eventListeners: Map<AuthEventType, Set<AuthEventListener>> = new Map();
  private refreshTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  /**
   * Initialize auth manager and restore session
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[AuthManager] Initializing...');
      
      // Restore auth state from secure storage
      await this.restoreAuthState();
      
      // Set up auto-refresh if we have tokens
      if (this.authState.isAuthenticated && AUTH_CONFIG.AUTO_REFRESH_ENABLED) {
        this.scheduleTokenRefresh();
      }

      this.isInitialized = true;
      console.log('[AuthManager] Initialized successfully');
    } catch (error) {
      console.error('[AuthManager] Initialization failed:', error);
      throw new AuthManagerError('Failed to initialize auth manager', 'INIT_FAILED');
    }
  }

  /**
   * Restore auth state from secure storage
   */
  private async restoreAuthState(): Promise<void> {
    try {
      const [token, refreshToken, userData] = await Promise.all([
        secureStorage.getItem(AUTH_CONFIG.TOKEN_STORAGE_KEY),
        secureStorage.getItem(AUTH_CONFIG.REFRESH_TOKEN_STORAGE_KEY),
        secureStorage.getItem(AUTH_CONFIG.USER_STORAGE_KEY),
      ]);

      if (token && refreshToken && userData) {
        const user = JSON.parse(userData);
        const tokenExpiry = this.extractTokenExpiry(token);

        this.authState = {
          isAuthenticated: true,
          token,
          refreshToken,
          tokenExpiry,
          user,
        };

        // Update API client with restored token
        secureApiClient.authToken = token;
        secureApiClient.refreshToken = refreshToken;
        secureApiClient.tokenExpiry = tokenExpiry;

        console.log('[AuthManager] Auth state restored from storage');
      }
    } catch (error) {
      console.error('[AuthManager] Failed to restore auth state:', error);
      await this.clearAuthState();
    }
  }

  /**
   * Extract token expiry from JWT token (basic implementation)
   */
  private extractTokenExpiry(token: string): number | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;

      const decoded = JSON.parse(atob(payload));
      return decoded.exp ? decoded.exp * 1000 : null; // Convert to milliseconds
    } catch (error) {
      console.warn('[AuthManager] Failed to extract token expiry:', error);
      return null;
    }
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Validate input
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      throw new AuthManagerError(emailValidation.error!, 'INVALID_EMAIL');
    }

    if (!password || password.length === 0) {
      throw new AuthManagerError('Password is required', 'INVALID_PASSWORD');
    }

    try {
      console.log('[AuthManager] Attempting login...');
      
      const response = await secureApiClient.authenticate(email, password);

      if (response.token && response.user) {
        await this.updateAuthState(response);
        this.emitEvent('login', { user: response.user });
        console.log('[AuthManager] Login successful');
      }

      return response;
    } catch (error) {
      console.error('[AuthManager] Login failed:', error);
      this.emitEvent('auth_error', { error });
      throw error;
    }
  }

  /**
   * Update auth state and persist to storage
   */
  private async updateAuthState(authResponse: AuthResponse): Promise<void> {
    const tokenExpiry = this.extractTokenExpiry(authResponse.token || '');

    this.authState = {
      isAuthenticated: true,
      token: authResponse.token || null,
      refreshToken: authResponse.refreshToken || null,
      tokenExpiry,
      user: authResponse.user || null,
    };

    // Persist to secure storage
    const promises = [];
    
    if (authResponse.token) {
      promises.push(secureStorage.setItem(AUTH_CONFIG.TOKEN_STORAGE_KEY, authResponse.token));
    }
    
    if (authResponse.refreshToken) {
      promises.push(secureStorage.setItem(AUTH_CONFIG.REFRESH_TOKEN_STORAGE_KEY, authResponse.refreshToken));
    }
    
    if (authResponse.user) {
      promises.push(secureStorage.setItem(AUTH_CONFIG.USER_STORAGE_KEY, JSON.stringify(authResponse.user)));
    }

    await Promise.all(promises);

    // Schedule token refresh
    if (AUTH_CONFIG.AUTO_REFRESH_ENABLED) {
      this.scheduleTokenRefresh();
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.authState.tokenExpiry) return;

    const now = Date.now();
    const timeUntilRefresh = this.authState.tokenExpiry - now - AUTH_CONFIG.TOKEN_EXPIRY_BUFFER_MS;

    if (timeUntilRefresh > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshToken();
      }, timeUntilRefresh);

      console.log(`[AuthManager] Token refresh scheduled in ${Math.round(timeUntilRefresh / 1000)}s`);
    } else {
      // Token is already expired or about to expire, refresh immediately
      this.refreshToken();
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<boolean> {
    if (!this.authState.refreshToken) {
      console.warn('[AuthManager] No refresh token available');
      await this.logout();
      return false;
    }

    try {
      console.log('[AuthManager] Refreshing token...');
      
      const refreshed = await secureApiClient.refreshAuthToken();
      
      if (refreshed) {
        // Update our state with the new tokens from the API client
        this.authState.token = secureApiClient.authToken;
        this.authState.refreshToken = secureApiClient.refreshToken;
        this.authState.tokenExpiry = secureApiClient.tokenExpiry;

        // Persist updated tokens
        if (this.authState.token) {
          await secureStorage.setItem(AUTH_CONFIG.TOKEN_STORAGE_KEY, this.authState.token);
        }
        if (this.authState.refreshToken) {
          await secureStorage.setItem(AUTH_CONFIG.REFRESH_TOKEN_STORAGE_KEY, this.authState.refreshToken);
        }

        this.scheduleTokenRefresh();
        this.emitEvent('token_refreshed', { timestamp: Date.now() });
        
        console.log('[AuthManager] Token refreshed successfully');
        return true;
      } else {
        console.warn('[AuthManager] Token refresh failed');
        await this.logout();
        return false;
      }
    } catch (error) {
      console.error('[AuthManager] Token refresh error:', error);
      await this.logout();
      this.emitEvent('auth_error', { error });
      return false;
    }
  }

  /**
   * Logout and clear auth state
   */
  async logout(): Promise<void> {
    console.log('[AuthManager] Logging out...');
    
    await this.clearAuthState();
    secureApiClient.clearAuth();
    
    this.emitEvent('logout', { timestamp: Date.now() });
    console.log('[AuthManager] Logout complete');
  }

  /**
   * Clear auth state and storage
   */
  private async clearAuthState(): Promise<void> {
    this.authState = {
      isAuthenticated: false,
      token: null,
      refreshToken: null,
      tokenExpiry: null,
      user: null,
    };

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Clear from secure storage
    await Promise.all([
      secureStorage.removeItem(AUTH_CONFIG.TOKEN_STORAGE_KEY),
      secureStorage.removeItem(AUTH_CONFIG.REFRESH_TOKEN_STORAGE_KEY),
      secureStorage.removeItem(AUTH_CONFIG.USER_STORAGE_KEY),
    ]);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated && !!this.authState.token;
  }

  /**
   * Get current user data
   */
  getCurrentUser(): AuthState['user'] {
    return this.authState.user;
  }

  /**
   * Get current auth token
   */
  getAuthToken(): string | null {
    return this.authState.token;
  }

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpired(): boolean {
    if (!this.authState.tokenExpiry) return false;
    
    const now = Date.now();
    return this.authState.tokenExpiry <= now + AUTH_CONFIG.TOKEN_EXPIRY_BUFFER_MS;
  }

  /**
   * Get auth state for debugging
   */
  getAuthState(): Omit<AuthState, 'token' | 'refreshToken'> {
    return {
      isAuthenticated: this.authState.isAuthenticated,
      token: this.authState.token ? '[REDACTED]' : null,
      refreshToken: this.authState.refreshToken ? '[REDACTED]' : null,
      tokenExpiry: this.authState.tokenExpiry,
      user: this.authState.user,
    } as any;
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: AuthEventType, listener: AuthEventListener): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: AuthEventType, listener: AuthEventListener): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit auth event
   */
  private emitEvent(eventType: AuthEventType, data?: unknown): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const event: AuthEvent = {
        type: eventType,
        timestamp: Date.now(),
        data,
      };

      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`[AuthManager] Event listener error for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    this.eventListeners.clear();
    console.log('[AuthManager] Cleanup completed');
  }
}

// Export singleton instance
export const authManager = AuthManager.getInstance();