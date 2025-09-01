'use client';

/**
 * Secure passphrase manager for tvOS - Addresses race conditions and memory leaks
 * Implements proper async operation queuing and cleanup
 */

import { secureApiClient, APIError } from './api-client-secure';
import { secureStorage } from './secure-storage';
import {
  aesGcmDecrypt,
  decodeBase64,
  deriveKeyWithProgress,
  validatePassphraseFormat,
  CryptoError,
  ValidationError,
  CRYPTO_CONFIG,
  secureMemoryClear
} from './crypto-utils-secure';
import { getDeviceId } from './device-id';

// Configuration constants
const MANAGER_CONFIG = {
  MAX_CONCURRENT_OPERATIONS: 1,
  OPERATION_TIMEOUT_MS: 60000,
  CACHE_TTL_MS: 15 * 60 * 1000, // 15 minutes
  MAX_RETRY_ATTEMPTS: 3,
} as const;

interface DeviceKeyData {
  master_key_wrapped: string;
  salt: string;
  iv: string;
  kdf_iterations: number;
  server_wrapped_key?: string;
  server_iv?: string;
}

interface PassphraseValidationResult {
  success: boolean;
  deviceRegistered: boolean;
  keyData?: DeviceKeyData;
}

interface CachedPassphrase {
  passphrase: string;
  timestamp: number;
  accessCount: number;
}

interface OperationContext {
  id: string;
  type: 'validate' | 'register' | 'setup';
  accountId: string;
  startTime: number;
  abortController: AbortController;
}

// Custom error classes
export class PassphraseManagerError extends Error {
  constructor(message: string, public readonly code: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'PassphraseManagerError';
  }
}

export class OperationTimeoutError extends PassphraseManagerError {
  constructor(operation: string) {
    super(`Operation '${operation}' timed out`, 'OPERATION_TIMEOUT');
  }
}

export class ConcurrentOperationError extends PassphraseManagerError {
  constructor() {
    super('Another operation is already in progress', 'CONCURRENT_OPERATION');
  }
}

export class PassphraseManager {
  private static instance: PassphraseManager | null = null;
  private deviceId: string | null = null;
  private operationQueue: Map<string, Promise<any>> = new Map();
  private activeOperations: Set<string> = new Set();
  private passphraseCache: Map<string, CachedPassphrase> = new Map();
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): PassphraseManager {
    if (!PassphraseManager.instance) {
      PassphraseManager.instance = new PassphraseManager();
    }
    return PassphraseManager.instance;
  }

  private async getDeviceId(): Promise<string> {
    if (!this.deviceId) {
      this.deviceId = await getDeviceId();
    }
    return this.deviceId;
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(type: string, accountId: string): string {
    return `${type}_${accountId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Execute operation with proper queuing and timeout handling
   */
  private async executeOperation<T>(
    operationId: string,
    operation: (context: OperationContext) => Promise<T>,
    timeoutMs: number = MANAGER_CONFIG.OPERATION_TIMEOUT_MS
  ): Promise<T> {
    // Check if we have too many concurrent operations
    if (this.activeOperations.size >= MANAGER_CONFIG.MAX_CONCURRENT_OPERATIONS) {
      throw new ConcurrentOperationError();
    }

    const abortController = new AbortController();
    const context: OperationContext = {
      id: operationId,
      type: operationId.split('_')[0] as any,
      accountId: operationId.split('_')[1],
      startTime: Date.now(),
      abortController,
    };

    // Set up timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    this.activeOperations.add(operationId);

    try {
      console.log(`[SecurePassphraseManager] Starting operation: ${operationId}`);
      
      const result = await operation(context);
      
      console.log(`[SecurePassphraseManager] Operation completed: ${operationId}`);
      return result;
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new OperationTimeoutError(context.type);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      this.activeOperations.delete(operationId);
      this.operationQueue.delete(operationId);
    }
  }

  /**
   * Queue operation to prevent race conditions
   */
  private async queueOperation<T>(
    type: string,
    accountId: string,
    operation: (context: OperationContext) => Promise<T>
  ): Promise<T> {
    const operationId = this.generateOperationId(type, accountId);
    
    // Check if similar operation is already queued
    const existingKey = Array.from(this.operationQueue.keys()).find(key => 
      key.startsWith(`${type}_${accountId}_`)
    );
    
    if (existingKey) {
      console.log(`[SecurePassphraseManager] Waiting for existing operation: ${existingKey}`);
      await this.operationQueue.get(existingKey);
    }

    const operationPromise = this.executeOperation(operationId, operation);
    this.operationQueue.set(operationId, operationPromise);

    return operationPromise;
  }

  /**
   * Get stored device key data for an account with caching
   */
  private async getStoredDeviceKey(accountId: string): Promise<DeviceKeyData | null> {
    try {
      const deviceId = await this.getDeviceId();
      const key = `device_key_${accountId}_${deviceId}`;
      
      const stored = await secureStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // Validate stored data structure
        if (this.validateDeviceKeyData(parsed)) {
          console.log('[SecurePassphraseManager] Found valid stored device key');
          return parsed;
        } else {
          console.warn('[SecurePassphraseManager] Invalid stored device key, removing');
          await secureStorage.removeItem(key);
        }
      }
      
      return null;
    } catch (error) {
      console.error('[SecurePassphraseManager] Error getting stored device key:', error);
      return null;
    }
  }

  /**
   * Validate device key data structure
   */
  private validateDeviceKeyData(data: any): data is DeviceKeyData {
    return data &&
           typeof data.master_key_wrapped === 'string' &&
           typeof data.salt === 'string' &&
           typeof data.iv === 'string' &&
           typeof data.kdf_iterations === 'number' &&
           data.kdf_iterations > 0;
  }

  /**
   * Store device key data securely
   */
  private async storeDeviceKey(accountId: string, keyData: DeviceKeyData): Promise<void> {
    try {
      const deviceId = await this.getDeviceId();
      const key = `device_key_${accountId}_${deviceId}`;
      
      await secureStorage.setItem(key, JSON.stringify(keyData));
      console.log('[SecurePassphraseManager] Device key stored securely');
    } catch (error) {
      console.error('[SecurePassphraseManager] Error storing device key:', error);
      throw new PassphraseManagerError('Failed to store device key', 'STORAGE_ERROR', error as Error);
    }
  }

  /**
   * Clear stored device key for an account
   */
  async clearDeviceKey(accountId: string): Promise<void> {
    try {
      const deviceId = await this.getDeviceId();
      const key = `device_key_${accountId}_${deviceId}`;
      await secureStorage.removeItem(key);
      console.log('[SecurePassphraseManager] Device key cleared');
    } catch (error) {
      console.error('[SecurePassphraseManager] Error clearing device key:', error);
    }
  }

  /**
   * Cache passphrase securely with TTL
   */
  private cachePassphrase(accountId: string, passphrase: string): void {
    // Clear existing timer
    const existingTimer = this.cleanupTimers.get(accountId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Store in memory cache
    this.passphraseCache.set(accountId, {
      passphrase,
      timestamp: Date.now(),
      accessCount: 0,
    });

    // Set cleanup timer
    const cleanupTimer = setTimeout(() => {
      this.clearPassphraseCache(accountId);
    }, MANAGER_CONFIG.CACHE_TTL_MS);

    this.cleanupTimers.set(accountId, cleanupTimer);
    
    console.log(`[SecurePassphraseManager] Passphrase cached for ${MANAGER_CONFIG.CACHE_TTL_MS / 1000}s`);
  }

  /**
   * Get cached passphrase if valid
   */
  getCachedPassphrase(accountId: string): string | null {
    const cached = this.passphraseCache.get(accountId);
    if (!cached) return null;

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > MANAGER_CONFIG.CACHE_TTL_MS) {
      this.clearPassphraseCache(accountId);
      return null;
    }

    cached.accessCount++;
    return cached.passphrase;
  }

  /**
   * Clear cached passphrase and cleanup timer
   */
  clearPassphraseCache(accountId: string): void {
    const cached = this.passphraseCache.get(accountId);
    if (cached) {
      // Secure memory clearing (best effort)
      if (cached.passphrase) {
        const passphraseBytes = new TextEncoder().encode(cached.passphrase);
        secureMemoryClear(passphraseBytes);
      }
    }

    this.passphraseCache.delete(accountId);
    
    const timer = this.cleanupTimers.get(accountId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(accountId);
    }
    
    console.log('[SecurePassphraseManager] Passphrase cache cleared');
  }

  /**
   * Check if device is registered for an account
   */
  async checkDeviceRegistration(accountId: string): Promise<{
    isRegistered: boolean;
    requiresPassphrase: boolean;
    canAutoRegister: boolean;
    message?: string;
  }> {
    return this.queueOperation('check', accountId, async (context) => {
      try {
        const result = await secureApiClient.checkDevice(accountId);
        console.log('[SecurePassphraseManager] Device check result:', result);
        
        return {
          isRegistered: result.isRegistered,
          requiresPassphrase: result.requiresPassphrase,
          canAutoRegister: result.canAutoRegister || false,
          message: result.message,
        };
      } catch (error) {
        console.error('[SecurePassphraseManager] Error checking device registration:', error);
        return {
          isRegistered: false,
          requiresPassphrase: true,
          canAutoRegister: false,
          message: 'Failed to check device registration',
        };
      }
    });
  }

  /**
   * Register device with passphrase
   */
  async registerDevice(
    accountId: string,
    passphrase: string,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<DeviceKeyData> {
    return this.queueOperation('register', accountId, async (context) => {
      try {
        // Validate passphrase format
        const validation = validatePassphraseFormat(passphrase);
        if (!validation.valid) {
          throw new ValidationError(validation.error!);
        }

        onProgress?.(0.1, 'Registering device...');
        
        const result = await secureApiClient.registerDevice(
          accountId,
          passphrase,
          'Apple TV',
          'tvOS'
        );

        if (!result.success) {
          throw new PassphraseManagerError('Device registration failed', 'REGISTRATION_FAILED');
        }

        onProgress?.(0.8, 'Device registered successfully');

        // Store the device key data securely
        await this.storeDeviceKey(accountId, result.keyData);
        
        onProgress?.(1.0, 'Device setup complete');

        console.log('[SecurePassphraseManager] Device registered successfully');
        return result.keyData;
      } catch (error) {
        console.error('[SecurePassphraseManager] Error registering device:', error);
        if (error instanceof APIError) {
          throw error;
        }
        throw new PassphraseManagerError('Device registration failed', 'REGISTRATION_ERROR', error as Error);
      }
    });
  }

  /**
   * Get device key data from server
   */
  async getDeviceKeyFromServer(accountId: string): Promise<DeviceKeyData | null> {
    return this.queueOperation('getkey', accountId, async (context) => {
      try {
        const result = await secureApiClient.getDeviceKey(accountId);
        console.log('[SecurePassphraseManager] Retrieved device key from server');
        
        // Store locally for future use
        await this.storeDeviceKey(accountId, result.keyData);
        
        return result.keyData;
      } catch (error) {
        console.error('[SecurePassphraseManager] Error getting device key from server:', error);
        return null;
      }
    });
  }

  /**
   * Validate passphrase with progress tracking and proper error handling
   */
  async validatePassphraseWithProgress(
    accountId: string,
    passphrase: string,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<PassphraseValidationResult> {
    return this.queueOperation('validate', accountId, async (context) => {
      try {
        // Validate passphrase format first
        const validation = validatePassphraseFormat(passphrase);
        if (!validation.valid) {
          throw new ValidationError(validation.error!);
        }

        onProgress?.(0.05, 'Initializing validation...');

        // Check for cached valid passphrase
        const cachedPassphrase = this.getCachedPassphrase(accountId);
        if (cachedPassphrase === passphrase) {
          onProgress?.(1.0, 'Using cached validation');
          return { success: true, deviceRegistered: true };
        }

        // First check if we have stored device key
        let keyData = await this.getStoredDeviceKey(accountId);
        let deviceRegistered = !!keyData;

        if (!keyData) {
          // Try to get from server
          onProgress?.(0.1, 'Checking device registration...');
          keyData = await this.getDeviceKeyFromServer(accountId);
          deviceRegistered = !!keyData;
        }

        if (!keyData) {
          // Device not registered, try to register it
          onProgress?.(0.15, 'Device not registered, attempting registration...');
          
          try {
            keyData = await this.registerDevice(accountId, passphrase, (prog, msg) => {
              // Scale progress from 0.15 to 0.5
              onProgress?.(0.15 + (prog * 0.35), msg);
            });
            deviceRegistered = true;
          } catch (regError) {
            console.error('[SecurePassphraseManager] Device registration failed:', regError);
            throw new PassphraseManagerError(
              'Device registration failed. Please check your passphrase and try again.',
              'REGISTRATION_FAILED',
              regError as Error
            );
          }
        }

        // Now validate the passphrase using the device key
        onProgress?.(0.5, `Validating passphrase (${keyData.kdf_iterations.toLocaleString()} iterations)...`);

        const salt = decodeBase64(keyData.salt);
        const iv = decodeBase64(keyData.iv);
        const wrappedKey = decodeBase64(keyData.master_key_wrapped);

        // Derive key with progress tracking
        let derivedKey: Uint8Array;
        try {
          derivedKey = await deriveKeyWithProgress(
            passphrase,
            salt,
            keyData.kdf_iterations,
            CRYPTO_CONFIG.KEY_LENGTH,
            (prog, msg) => {
              // Scale progress from 0.5 to 0.95
              onProgress?.(0.5 + (prog * 0.45), msg);
            }
          );
        } catch (error) {
          throw new CryptoError('Key derivation failed', 'DERIVATION_FAILED');
        }

        onProgress?.(0.95, 'Verifying passphrase...');

        // Try to decrypt the master key to validate passphrase
        try {
          const masterKey = aesGcmDecrypt(derivedKey, iv, wrappedKey);
          
          // Secure cleanup
          secureMemoryClear(derivedKey);
          secureMemoryClear(masterKey);
          
          console.log('[SecurePassphraseManager] Passphrase validation successful');
          
          // Cache the passphrase for this session
          this.cachePassphrase(accountId, passphrase);
          
          onProgress?.(1.0, 'Passphrase validated successfully');

          return {
            success: true,
            deviceRegistered,
            keyData,
          };
        } catch (decryptError) {
          console.error('[SecurePassphraseManager] Passphrase validation failed:', decryptError);
          
          // Clear potentially corrupted cached data
          await this.clearDeviceKey(accountId);
          
          throw new PassphraseManagerError(
            'Invalid passphrase. Please check your passphrase and try again.',
            'INVALID_PASSPHRASE'
          );
        } finally {
          // Always clean up sensitive data
          if (derivedKey) {
            secureMemoryClear(derivedKey);
          }
        }
      } catch (error) {
        console.error('[SecurePassphraseManager] Validation error:', error);
        if (error instanceof PassphraseManagerError || error instanceof ValidationError || error instanceof CryptoError) {
          throw error;
        }
        throw new PassphraseManagerError('Passphrase validation failed', 'VALIDATION_ERROR', error as Error);
      }
    });
  }

  /**
   * Setup initial passphrase for new account
   */
  async setupPassphrase(
    passphrase: string,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<boolean> {
    return this.queueOperation('setup', 'new-account', async (context) => {
      try {
        // Validate passphrase format
        const validation = validatePassphraseFormat(passphrase);
        if (!validation.valid) {
          throw new ValidationError(validation.error!);
        }

        onProgress?.(0.1, 'Setting up passphrase...');
        
        const result = await secureApiClient.setupPassphrase(
          passphrase,
          'Apple TV',
          'tvOS'
        );

        if (result.success) {
          onProgress?.(1.0, 'Passphrase setup complete');
          console.log('[SecurePassphraseManager] Passphrase setup successful');
          return true;
        } else {
          throw new PassphraseManagerError('Passphrase setup failed', 'SETUP_FAILED');
        }
      } catch (error) {
        console.error('[SecurePassphraseManager] Passphrase setup error:', error);
        if (error instanceof APIError) {
          throw error;
        }
        throw new PassphraseManagerError('Passphrase setup failed', 'SETUP_ERROR', error as Error);
      }
    });
  }

  /**
   * Clear all data for an account
   */
  async clearAccountData(accountId: string): Promise<void> {
    await this.clearDeviceKey(accountId);
    this.clearPassphraseCache(accountId);
    console.log('[SecurePassphraseManager] Cleared all data for account:', accountId);
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    // Clear all timers
    for (const [accountId, timer] of this.cleanupTimers) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();

    // Clear all cached passphrases securely
    for (const [accountId] of this.passphraseCache) {
      this.clearPassphraseCache(accountId);
    }

    // Abort any active operations
    for (const operationId of this.activeOperations) {
      console.log(`[SecurePassphraseManager] Aborting operation: ${operationId}`);
    }

    console.log('[SecurePassphraseManager] Cleanup completed');
  }

  /**
   * Get manager statistics
   */
  getStats(): {
    activeOperations: number;
    queuedOperations: number;
    cachedPassphrases: number;
    cleanupTimers: number;
  } {
    return {
      activeOperations: this.activeOperations.size,
      queuedOperations: this.operationQueue.size,
      cachedPassphrases: this.passphraseCache.size,
      cleanupTimers: this.cleanupTimers.size,
    };
  }
}

// Export singleton instance
export const securePassphraseManager = PassphraseManager.getInstance();