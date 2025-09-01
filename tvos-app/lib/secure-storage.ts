'use client';

/**
 * Secure storage manager for tvOS
 * Addresses plaintext storage risks by adding encryption layer
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  aesGcmEncrypt, 
  aesGcmDecrypt, 
  getSecureRandomBytes, 
  deriveKey,
  encodeBase64,
  decodeBase64,
  CryptoError,
  ValidationError,
  CRYPTO_CONFIG
} from './crypto-utils-secure';

// Storage configuration
const STORAGE_CONFIG = {
  ENCRYPTION_KEY_LENGTH: 32,
  NONCE_LENGTH: 12,
  SALT_LENGTH: 16,
  STORAGE_VERSION: 1,
  MASTER_KEY_STORAGE_KEY: '_secure_master_key',
  KEY_DERIVATION_ITERATIONS: 10000, // Lower for storage key derivation
} as const;

interface SecureStorageEntry {
  version: number;
  salt: string;
  nonce: string;
  data: string;
  timestamp: number;
}

interface StorageMetadata {
  created: number;
  lastAccessed: number;
  accessCount: number;
}

export class SecureStorageError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'SecureStorageError';
  }
}

class SecureStorage {
  private static instance: SecureStorage | null = null;
  private masterKey: Uint8Array | null = null;
  private isInitialized = false;

  static getInstance(): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage();
    }
    return SecureStorage.instance;
  }

  /**
   * Initialize secure storage with device-specific encryption
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Try to load existing master key
      const storedKey = await AsyncStorage.getItem(STORAGE_CONFIG.MASTER_KEY_STORAGE_KEY);
      
      if (storedKey) {
        // Decrypt existing master key using device-specific derivation
        const keyData = JSON.parse(storedKey);
        this.masterKey = await this.deriveStorageMasterKey(keyData.salt);
        console.log('[SecureStorage] Existing master key loaded');
      } else {
        // Generate new master key
        const salt = getSecureRandomBytes(STORAGE_CONFIG.SALT_LENGTH);
        this.masterKey = await this.deriveStorageMasterKey(encodeBase64(salt));
        
        // Store salt for future key derivation
        await AsyncStorage.setItem(
          STORAGE_CONFIG.MASTER_KEY_STORAGE_KEY,
          JSON.stringify({
            salt: encodeBase64(salt),
            created: Date.now(),
            version: STORAGE_CONFIG.STORAGE_VERSION
          })
        );
        
        console.log('[SecureStorage] New master key generated');
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('[SecureStorage] Initialization failed:', error);
      throw new SecureStorageError('Failed to initialize secure storage', 'INIT_FAILED');
    }
  }

  /**
   * Derive storage master key from device-specific information
   */
  private async deriveStorageMasterKey(saltBase64: string): Promise<Uint8Array> {
    // Use device-specific information as password
    // This is not perfect but better than plaintext storage
    const deviceInfo = await this.getDeviceSpecificInfo();
    const salt = decodeBase64(saltBase64);
    
    return deriveKey(
      deviceInfo,
      salt,
      STORAGE_CONFIG.KEY_DERIVATION_ITERATIONS,
      STORAGE_CONFIG.ENCRYPTION_KEY_LENGTH
    );
  }

  /**
   * Get device-specific information for key derivation
   */
  private async getDeviceSpecificInfo(): Promise<string> {
    // Combine various device-specific factors
    const factors = [
      'tvos-device', // Platform identifier
      navigator?.userAgent || 'unknown-agent',
      screen?.width?.toString() || '1920',
      screen?.height?.toString() || '1080',
      Date.now().toString().slice(0, -6), // Rough installation time (removes last 6 digits)
    ];
    
    return factors.join('|');
  }

  /**
   * Securely store encrypted data
   */
  async setItem(key: string, value: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.masterKey) {
      throw new SecureStorageError('Storage not properly initialized', 'NOT_INITIALIZED');
    }

    try {
      const nonce = getSecureRandomBytes(STORAGE_CONFIG.NONCE_LENGTH);
      const plaintext = new TextEncoder().encode(value);
      
      // Encrypt the data
      const encrypted = aesGcmEncrypt(this.masterKey, nonce, plaintext);
      
      const entry: SecureStorageEntry = {
        version: STORAGE_CONFIG.STORAGE_VERSION,
        salt: '', // Not needed for individual entries
        nonce: encodeBase64(nonce),
        data: encodeBase64(encrypted),
        timestamp: Date.now(),
      };

      await AsyncStorage.setItem(`secure_${key}`, JSON.stringify(entry));
      
      // Update metadata
      await this.updateMetadata(key, 'write');
      
      console.log(`[SecureStorage] Securely stored item: ${key}`);
    } catch (error) {
      console.error(`[SecureStorage] Failed to store item ${key}:`, error);
      throw new SecureStorageError(`Failed to store item: ${key}`, 'STORE_FAILED');
    }
  }

  /**
   * Retrieve and decrypt stored data
   */
  async getItem(key: string): Promise<string | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.masterKey) {
      throw new SecureStorageError('Storage not properly initialized', 'NOT_INITIALIZED');
    }

    try {
      const stored = await AsyncStorage.getItem(`secure_${key}`);
      if (!stored) return null;

      const entry: SecureStorageEntry = JSON.parse(stored);
      
      // Verify version compatibility
      if (entry.version !== STORAGE_CONFIG.STORAGE_VERSION) {
        console.warn(`[SecureStorage] Version mismatch for ${key}, clearing entry`);
        await this.removeItem(key);
        return null;
      }

      const nonce = decodeBase64(entry.nonce);
      const encrypted = decodeBase64(entry.data);
      
      // Decrypt the data
      const decrypted = aesGcmDecrypt(this.masterKey, nonce, encrypted);
      const value = new TextDecoder().decode(decrypted);
      
      // Update metadata
      await this.updateMetadata(key, 'read');
      
      console.log(`[SecureStorage] Retrieved item: ${key}`);
      return value;
    } catch (error) {
      if (error instanceof CryptoError) {
        console.warn(`[SecureStorage] Failed to decrypt item ${key}, clearing:`, error);
        await this.removeItem(key);
        return null;
      }
      
      console.error(`[SecureStorage] Failed to retrieve item ${key}:`, error);
      throw new SecureStorageError(`Failed to retrieve item: ${key}`, 'RETRIEVE_FAILED');
    }
  }

  /**
   * Remove stored item
   */
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`secure_${key}`);
      await AsyncStorage.removeItem(`meta_${key}`);
      console.log(`[SecureStorage] Removed item: ${key}`);
    } catch (error) {
      console.error(`[SecureStorage] Failed to remove item ${key}:`, error);
    }
  }

  /**
   * Update item metadata
   */
  private async updateMetadata(key: string, operation: 'read' | 'write'): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(`meta_${key}`);
      let metadata: StorageMetadata;

      if (existing) {
        metadata = JSON.parse(existing);
        metadata.lastAccessed = Date.now();
        metadata.accessCount += 1;
      } else {
        metadata = {
          created: Date.now(),
          lastAccessed: Date.now(),
          accessCount: 1,
        };
      }

      await AsyncStorage.setItem(`meta_${key}`, JSON.stringify(metadata));
    } catch (error) {
      // Non-critical error, don't throw
      console.warn(`[SecureStorage] Failed to update metadata for ${key}:`, error);
    }
  }

  /**
   * Get item metadata
   */
  async getMetadata(key: string): Promise<StorageMetadata | null> {
    try {
      const stored = await AsyncStorage.getItem(`meta_${key}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn(`[SecureStorage] Failed to get metadata for ${key}:`, error);
      return null;
    }
  }

  /**
   * Clear all secure storage data
   */
  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const secureKeys = keys.filter(key => key.startsWith('secure_') || key.startsWith('meta_'));
      
      await AsyncStorage.multiRemove(secureKeys);
      await AsyncStorage.removeItem(STORAGE_CONFIG.MASTER_KEY_STORAGE_KEY);
      
      this.masterKey = null;
      this.isInitialized = false;
      
      console.log('[SecureStorage] All secure data cleared');
    } catch (error) {
      console.error('[SecureStorage] Failed to clear all data:', error);
      throw new SecureStorageError('Failed to clear storage', 'CLEAR_FAILED');
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalItems: number;
    totalSize: number;
    oldestItem?: { key: string; created: number };
    mostAccessed?: { key: string; accessCount: number };
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const secureKeys = keys.filter(key => key.startsWith('secure_'));
      
      let totalSize = 0;
      let oldestItem: { key: string; created: number } | undefined;
      let mostAccessed: { key: string; accessCount: number } | undefined;

      for (const key of secureKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += data.length;
        }

        const metaKey = key.replace('secure_', '');
        const metadata = await this.getMetadata(metaKey);
        
        if (metadata) {
          if (!oldestItem || metadata.created < oldestItem.created) {
            oldestItem = { key: metaKey, created: metadata.created };
          }
          
          if (!mostAccessed || metadata.accessCount > mostAccessed.accessCount) {
            mostAccessed = { key: metaKey, accessCount: metadata.accessCount };
          }
        }
      }

      return {
        totalItems: secureKeys.length,
        totalSize,
        oldestItem,
        mostAccessed,
      };
    } catch (error) {
      console.error('[SecureStorage] Failed to get storage stats:', error);
      return { totalItems: 0, totalSize: 0 };
    }
  }
}

// Export singleton instance
export const secureStorage = SecureStorage.getInstance();