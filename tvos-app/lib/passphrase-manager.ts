'use client';

/**
 * Passphrase validation and device management for tvOS
 * Handles device registration, key derivation, and passphrase verification
 */

import { apiClient } from './api-client';
import {
  aesGcmDecrypt,
  decodeBase64,
  deriveKeyWithProgress,
  getOptimalIterations,
} from './crypto-utils';
import { getDeviceId } from './device-id';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_KEY_STORAGE_PREFIX = 'device_key_';
const PASSPHRASE_CACHE_PREFIX = 'passphrase_cache_';

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

export class PassphraseManager {
  private static instance: PassphraseManager | null = null;
  private deviceId: string | null = null;

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
   * Get stored device key data for an account
   */
  private async getStoredDeviceKey(accountId: string): Promise<DeviceKeyData | null> {
    try {
      const deviceId = await this.getDeviceId();
      const key = `${DEVICE_KEY_STORAGE_PREFIX}${accountId}_${deviceId}`;
      const stored = await AsyncStorage.getItem(key);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('[PassphraseManager] Found stored device key for account:', accountId);
        return parsed;
      }
      
      return null;
    } catch (error) {
      console.error('[PassphraseManager] Error getting stored device key:', error);
      return null;
    }
  }

  /**
   * Store device key data for an account
   */
  private async storeDeviceKey(accountId: string, keyData: DeviceKeyData): Promise<void> {
    try {
      const deviceId = await this.getDeviceId();
      const key = `${DEVICE_KEY_STORAGE_PREFIX}${accountId}_${deviceId}`;
      await AsyncStorage.setItem(key, JSON.stringify(keyData));
      console.log('[PassphraseManager] Stored device key for account:', accountId);
    } catch (error) {
      console.error('[PassphraseManager] Error storing device key:', error);
    }
  }

  /**
   * Clear stored device key for an account
   */
  async clearDeviceKey(accountId: string): Promise<void> {
    try {
      const deviceId = await this.getDeviceId();
      const key = `${DEVICE_KEY_STORAGE_PREFIX}${accountId}_${deviceId}`;
      await AsyncStorage.removeItem(key);
      console.log('[PassphraseManager] Cleared device key for account:', accountId);
    } catch (error) {
      console.error('[PassphraseManager] Error clearing device key:', error);
    }
  }

  /**
   * Cache passphrase temporarily for the session
   */
  private async cachePassphrase(accountId: string, passphrase: string): Promise<void> {
    try {
      const key = `${PASSPHRASE_CACHE_PREFIX}${accountId}`;
      await AsyncStorage.setItem(key, passphrase);
    } catch (error) {
      console.error('[PassphraseManager] Error caching passphrase:', error);
    }
  }

  /**
   * Get cached passphrase
   */
  async getCachedPassphrase(accountId: string): Promise<string | null> {
    try {
      const key = `${PASSPHRASE_CACHE_PREFIX}${accountId}`;
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('[PassphraseManager] Error getting cached passphrase:', error);
      return null;
    }
  }

  /**
   * Clear cached passphrase
   */
  async clearPassphraseCache(accountId: string): Promise<void> {
    try {
      const key = `${PASSPHRASE_CACHE_PREFIX}${accountId}`;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('[PassphraseManager] Error clearing passphrase cache:', error);
    }
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
    try {
      const result = await apiClient.checkDevice(accountId);
      console.log('[PassphraseManager] Device check result:', result);
      return {
        isRegistered: result.isRegistered,
        requiresPassphrase: result.requiresPassphrase,
        canAutoRegister: result.canAutoRegister || false,
        message: result.message,
      };
    } catch (error) {
      console.error('[PassphraseManager] Error checking device registration:', error);
      return {
        isRegistered: false,
        requiresPassphrase: true,
        canAutoRegister: false,
        message: 'Failed to check device registration',
      };
    }
  }

  /**
   * Register device with passphrase
   */
  async registerDevice(
    accountId: string,
    passphrase: string,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<DeviceKeyData> {
    try {
      onProgress?.(0.1, 'Registering device...');
      
      const result = await apiClient.registerDevice(
        accountId,
        passphrase,
        'Apple TV', // Device name
        'tvOS' // Device model
      );

      if (!result.success) {
        throw new Error('Device registration failed');
      }

      onProgress?.(0.8, 'Device registered successfully');

      // Store the device key data locally
      await this.storeDeviceKey(accountId, result.keyData);
      
      onProgress?.(1.0, 'Device setup complete');

      console.log('[PassphraseManager] Device registered successfully');
      return result.keyData;
    } catch (error) {
      console.error('[PassphraseManager] Error registering device:', error);
      throw error;
    }
  }

  /**
   * Get device key data from server
   */
  async getDeviceKeyFromServer(accountId: string): Promise<DeviceKeyData | null> {
    try {
      const result = await apiClient.getDeviceKey(accountId);
      console.log('[PassphraseManager] Retrieved device key from server');
      
      // Store locally for future use
      await this.storeDeviceKey(accountId, result.keyData);
      
      return result.keyData;
    } catch (error) {
      console.error('[PassphraseManager] Error getting device key from server:', error);
      return null;
    }
  }

  /**
   * Validate passphrase with progress tracking
   */
  async validatePassphraseWithProgress(
    accountId: string,
    passphrase: string,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<PassphraseValidationResult> {
    try {
      onProgress?.(0.05, 'Initializing validation...');

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
          console.error('[PassphraseManager] Device registration failed:', regError);
          throw new Error('Device registration failed. Please check your passphrase and try again.');
        }
      }

      // Now validate the passphrase using the device key
      onProgress?.(0.5, `Validating passphrase (${keyData.kdf_iterations.toLocaleString()} iterations)...`);

      const salt = decodeBase64(keyData.salt);
      const iv = decodeBase64(keyData.iv);
      const wrappedKey = decodeBase64(keyData.master_key_wrapped);

      // Derive key with progress tracking
      const derivedKey = await deriveKeyWithProgress(
        passphrase,
        salt,
        keyData.kdf_iterations,
        32,
        (prog, msg) => {
          // Scale progress from 0.5 to 0.95
          onProgress?.(0.5 + (prog * 0.45), msg);
        }
      );

      onProgress?.(0.95, 'Verifying passphrase...');

      // Try to decrypt the master key to validate passphrase
      try {
        const masterKey = aesGcmDecrypt(derivedKey, iv, wrappedKey);
        console.log('[PassphraseManager] Passphrase validation successful');
        
        // Cache the passphrase for this session
        await this.cachePassphrase(accountId, passphrase);
        
        onProgress?.(1.0, 'Passphrase validated successfully');

        return {
          success: true,
          deviceRegistered,
          keyData,
        };
      } catch (decryptError) {
        console.error('[PassphraseManager] Passphrase validation failed:', decryptError);
        
        // Clear potentially corrupted cached data
        await this.clearDeviceKey(accountId);
        
        throw new Error('Invalid passphrase. Please check your passphrase and try again.');
      }
    } catch (error) {
      console.error('[PassphraseManager] Validation error:', error);
      throw error;
    }
  }

  /**
   * Setup initial passphrase for new account
   */
  async setupPassphrase(
    passphrase: string,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<boolean> {
    try {
      onProgress?.(0.1, 'Setting up passphrase...');
      
      const result = await apiClient.setupPassphrase(
        passphrase,
        'Apple TV',
        'tvOS'
      );

      if (result.success) {
        onProgress?.(1.0, 'Passphrase setup complete');
        console.log('[PassphraseManager] Passphrase setup successful');
        return true;
      } else {
        throw new Error('Passphrase setup failed');
      }
    } catch (error) {
      console.error('[PassphraseManager] Passphrase setup error:', error);
      throw error;
    }
  }

  /**
   * Clear all stored data for an account
   */
  async clearAccountData(accountId: string): Promise<void> {
    await this.clearDeviceKey(accountId);
    await this.clearPassphraseCache(accountId);
    console.log('[PassphraseManager] Cleared all data for account:', accountId);
  }
}

// Export singleton instance
export const passphraseManager = PassphraseManager.getInstance();