/**
 * Encrypted source cache manager for tvOS
 * Handles caching of IPTV sources, credentials, and metadata with encryption
 */

import { secureStorage } from './secure-storage';
import { integratedApiClient } from './api-client-integrated';
import { authManager } from './auth-manager';
import { securePassphraseManager } from './passphrase-manager-secure';
import {
  aesGcmEncrypt,
  aesGcmDecrypt,
  getSecureRandomBytes,
  deriveKey,
  encodeBase64,
  decodeBase64,
  CryptoError,
  CRYPTO_CONFIG,
  secureMemoryClear
} from './crypto-utils-secure';
import {
  SourceData,
  EncryptedSourceData,
  DeviceKeyData,
} from './types';

// Cache configuration
const CACHE_CONFIG = {
  SOURCES_CACHE_KEY: 'encrypted_sources',
  METADATA_CACHE_KEY_PREFIX: 'metadata_',
  CACHE_VERSION: 1,
  MAX_CACHE_SIZE: 50 * 1024 * 1024, // 50MB max cache size
  DEFAULT_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
  METADATA_TTL_MS: 7 * 24 * 60 * 60 * 1000, // 7 days for metadata
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1 hour cleanup interval
  MAX_SOURCES_COUNT: 1000,
} as const;

interface CachedSource {
  readonly id: string;
  readonly encryptedData: string;
  readonly nonce: string;
  readonly timestamp: number;
  readonly ttl: number;
  readonly version: number;
  readonly checksum: string;
}

interface CachedMetadata {
  readonly id: string;
  readonly encryptedData: string;
  readonly nonce: string;
  readonly timestamp: number;
  readonly ttl: number;
  readonly contentType: string;
  readonly tmdbId?: number;
  readonly title?: string;
}

interface CacheStats {
  readonly totalSources: number;
  readonly totalMetadata: number;
  readonly totalSize: number;
  readonly oldestEntry: number;
  readonly newestEntry: number;
  readonly hitRate: number;
  readonly missRate: number;
}

export class SourceCacheError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'SourceCacheError';
  }
}

export class SourceCacheManager {
  private static instance: SourceCacheManager | null = null;
  private encryptionKey: Uint8Array | null = null;
  private isInitialized = false;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private cacheStats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
  };

  static getInstance(): SourceCacheManager {
    if (!SourceCacheManager.instance) {
      SourceCacheManager.instance = new SourceCacheManager();
    }
    return SourceCacheManager.instance;
  }

  /**
   * Initialize cache manager with encryption key
   */
  async initialize(accountId?: string): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[SourceCache] Initializing...');
      
      // Get or derive encryption key
      await this.setupEncryptionKey(accountId);
      
      // Start cleanup timer
      this.startCleanupTimer();
      
      this.isInitialized = true;
      console.log('[SourceCache] Initialized successfully');
    } catch (error) {
      console.error('[SourceCache] Initialization failed:', error);
      throw new SourceCacheError('Failed to initialize source cache', 'INIT_FAILED');
    }
  }

  /**
   * Setup encryption key from user's master key or derive from device
   */
  private async setupEncryptionKey(accountId?: string): Promise<void> {
    try {
      if (accountId) {
        // Try to get cached passphrase for key derivation
        const cachedPassphrase = securePassphraseManager.getCachedPassphrase(accountId);
        
        if (cachedPassphrase) {
          // Derive cache key from passphrase
          const salt = getSecureRandomBytes(CRYPTO_CONFIG.SALT_LENGTH);
          this.encryptionKey = deriveKey(
            `cache_${cachedPassphrase}_${accountId}`,
            salt,
            10000, // Lower iterations for cache key
            CRYPTO_CONFIG.KEY_LENGTH
          );
          
          // Store salt for future use
          await secureStorage.setItem('cache_salt', encodeBase64(salt));
          console.log('[SourceCache] Encryption key derived from passphrase');
          return;
        }
      }

      // Fallback: use device-specific key
      const deviceSpecificInfo = await this.getDeviceSpecificInfo();
      const existingSalt = await secureStorage.getItem('cache_salt');
      
      let salt: Uint8Array;
      if (existingSalt) {
        salt = decodeBase64(existingSalt);
      } else {
        salt = getSecureRandomBytes(CRYPTO_CONFIG.SALT_LENGTH);
        await secureStorage.setItem('cache_salt', encodeBase64(salt));
      }

      this.encryptionKey = deriveKey(
        deviceSpecificInfo,
        salt,
        10000,
        CRYPTO_CONFIG.KEY_LENGTH
      );

      console.log('[SourceCache] Encryption key derived from device info');
    } catch (error) {
      console.error('[SourceCache] Failed to setup encryption key:', error);
      throw new SourceCacheError('Failed to setup encryption key', 'KEY_SETUP_FAILED');
    }
  }

  /**
   * Get device-specific information for key derivation
   */
  private async getDeviceSpecificInfo(): Promise<string> {
    const factors = [
      'tvos-cache',
      authManager.getCurrentUser()?.id || 'anonymous',
      Date.now().toString().slice(0, -6), // Rough installation time
    ];
    
    return factors.join('|');
  }

  /**
   * Encrypt source data
   */
  private encryptSourceData(data: SourceData): { encrypted: string; nonce: string } {
    if (!this.encryptionKey) {
      throw new SourceCacheError('Cache not initialized', 'NOT_INITIALIZED');
    }

    const nonce = getSecureRandomBytes(CRYPTO_CONFIG.IV_LENGTH);
    const plaintext = new TextEncoder().encode(JSON.stringify(data));
    
    const encrypted = aesGcmEncrypt(this.encryptionKey, nonce, plaintext);
    
    return {
      encrypted: encodeBase64(encrypted),
      nonce: encodeBase64(nonce),
    };
  }

  /**
   * Decrypt source data
   */
  private decryptSourceData(encryptedData: string, nonce: string): SourceData {
    if (!this.encryptionKey) {
      throw new SourceCacheError('Cache not initialized', 'NOT_INITIALIZED');
    }

    try {
      const encrypted = decodeBase64(encryptedData);
      const nonceBytes = decodeBase64(nonce);
      
      const decrypted = aesGcmDecrypt(this.encryptionKey, nonceBytes, encrypted);
      const jsonString = new TextDecoder().decode(decrypted);
      
      return JSON.parse(jsonString);
    } catch (error) {
      throw new SourceCacheError('Failed to decrypt source data', 'DECRYPTION_FAILED');
    }
  }

  /**
   * Generate checksum for data integrity
   */
  private generateChecksum(data: string): string {
    // Simple checksum using string hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Cache sources with encryption
   */
  async cacheSources(sources: SourceData[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const cachedSources: CachedSource[] = [];
      
      for (const source of sources.slice(0, CACHE_CONFIG.MAX_SOURCES_COUNT)) {
        const { encrypted, nonce } = this.encryptSourceData(source);
        const checksum = this.generateChecksum(encrypted);
        
        cachedSources.push({
          id: source.id,
          encryptedData: encrypted,
          nonce,
          timestamp: Date.now(),
          ttl: CACHE_CONFIG.DEFAULT_TTL_MS,
          version: CACHE_CONFIG.CACHE_VERSION,
          checksum,
        });
      }

      await secureStorage.setItem(
        CACHE_CONFIG.SOURCES_CACHE_KEY,
        JSON.stringify(cachedSources)
      );

      console.log(`[SourceCache] Cached ${cachedSources.length} sources`);
    } catch (error) {
      console.error('[SourceCache] Failed to cache sources:', error);
      throw new SourceCacheError('Failed to cache sources', 'CACHE_FAILED');
    }
  }

  /**
   * Retrieve cached sources
   */
  async getCachedSources(): Promise<SourceData[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const cached = await secureStorage.getItem(CACHE_CONFIG.SOURCES_CACHE_KEY);
      if (!cached) {
        this.cacheStats.misses++;
        return [];
      }

      const cachedSources: CachedSource[] = JSON.parse(cached);
      const now = Date.now();
      const validSources: SourceData[] = [];

      for (const cachedSource of cachedSources) {
        // Check TTL
        if (now - cachedSource.timestamp > cachedSource.ttl) {
          continue; // Skip expired
        }

        // Verify checksum
        const currentChecksum = this.generateChecksum(cachedSource.encryptedData);
        if (currentChecksum !== cachedSource.checksum) {
          console.warn(`[SourceCache] Checksum mismatch for source ${cachedSource.id}`);
          continue;
        }

        try {
          const decryptedSource = this.decryptSourceData(
            cachedSource.encryptedData,
            cachedSource.nonce
          );
          validSources.push(decryptedSource);
        } catch (error) {
          console.warn(`[SourceCache] Failed to decrypt source ${cachedSource.id}:`, error);
        }
      }

      this.cacheStats.hits++;
      console.log(`[SourceCache] Retrieved ${validSources.length} valid sources from cache`);
      return validSources;
    } catch (error) {
      console.error('[SourceCache] Failed to get cached sources:', error);
      this.cacheStats.misses++;
      return [];
    }
  }

  /**
   * Sync sources from API and update cache
   */
  async syncSources(): Promise<SourceData[]> {
    try {
      console.log('[SourceCache] Syncing sources from API...');
      
      const response = await integratedApiClient.getSources();
      const sources: SourceData[] = response.sources.map(source => ({
        id: source.id,
        name: source.name,
        type: source.type,
        url: source.url,
        credentials: source.credentials,
        metadata: source.metadata,
        encrypted: source.encrypted || false,
        lastUpdated: Date.now(),
      }));

      // Cache the sources
      await this.cacheSources(sources);
      
      console.log(`[SourceCache] Synced and cached ${sources.length} sources`);
      return sources;
    } catch (error) {
      console.error('[SourceCache] Failed to sync sources:', error);
      
      // Try to return cached sources on sync failure
      const cachedSources = await this.getCachedSources();
      if (cachedSources.length > 0) {
        console.log('[SourceCache] Using cached sources due to sync failure');
        return cachedSources;
      }
      
      throw new SourceCacheError('Failed to sync sources and no cache available', 'SYNC_FAILED');
    }
  }

  /**
   * Cache metadata
   */
  async cacheMetadata(
    key: string,
    metadata: any,
    contentType: string,
    tmdbId?: number,
    title?: string
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const { encrypted, nonce } = this.encryptSourceData(metadata);
      
      const cachedMetadata: CachedMetadata = {
        id: key,
        encryptedData: encrypted,
        nonce,
        timestamp: Date.now(),
        ttl: CACHE_CONFIG.METADATA_TTL_MS,
        contentType,
        tmdbId,
        title,
      };

      await secureStorage.setItem(
        `${CACHE_CONFIG.METADATA_CACHE_KEY_PREFIX}${key}`,
        JSON.stringify(cachedMetadata)
      );

      console.log(`[SourceCache] Cached metadata for key: ${key}`);
    } catch (error) {
      console.error('[SourceCache] Failed to cache metadata:', error);
    }
  }

  /**
   * Get cached metadata
   */
  async getCachedMetadata(key: string): Promise<any | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const cached = await secureStorage.getItem(
        `${CACHE_CONFIG.METADATA_CACHE_KEY_PREFIX}${key}`
      );
      
      if (!cached) {
        return null;
      }

      const cachedMetadata: CachedMetadata = JSON.parse(cached);
      
      // Check TTL
      if (Date.now() - cachedMetadata.timestamp > cachedMetadata.ttl) {
        await secureStorage.removeItem(`${CACHE_CONFIG.METADATA_CACHE_KEY_PREFIX}${key}`);
        return null;
      }

      return this.decryptSourceData(cachedMetadata.encryptedData, cachedMetadata.nonce);
    } catch (error) {
      console.error('[SourceCache] Failed to get cached metadata:', error);
      return null;
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    try {
      await secureStorage.removeItem(CACHE_CONFIG.SOURCES_CACHE_KEY);
      
      // Clear metadata cache
      const stats = await secureStorage.getStorageStats();
      // This is a simplified approach - in a real implementation, you'd track metadata keys
      
      console.log('[SourceCache] Cache cleared');
    } catch (error) {
      console.error('[SourceCache] Failed to clear cache:', error);
    }
  }

  /**
   * Start cleanup timer for expired entries
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, CACHE_CONFIG.CLEANUP_INTERVAL_MS);
  }

  /**
   * Perform cache cleanup
   */
  private async performCleanup(): Promise<void> {
    try {
      console.log('[SourceCache] Performing cleanup...');
      
      // Clean up sources
      const cachedSources = await this.getCachedSources();
      if (cachedSources.length > 0) {
        await this.cacheSources(cachedSources); // This will re-cache only valid sources
      }

      // Additional cleanup logic can be added here
      console.log('[SourceCache] Cleanup completed');
    } catch (error) {
      console.error('[SourceCache] Cleanup failed:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    const storageStats = await secureStorage.getStorageStats();
    const cachedSources = await this.getCachedSources();
    
    this.cacheStats.totalRequests = this.cacheStats.hits + this.cacheStats.misses;
    
    return {
      totalSources: cachedSources.length,
      totalMetadata: 0, // Simplified - would need to track metadata count
      totalSize: storageStats.totalSize,
      oldestEntry: storageStats.oldestItem?.created || 0,
      newestEntry: Date.now(),
      hitRate: this.cacheStats.totalRequests > 0 ? this.cacheStats.hits / this.cacheStats.totalRequests : 0,
      missRate: this.cacheStats.totalRequests > 0 ? this.cacheStats.misses / this.cacheStats.totalRequests : 0,
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.encryptionKey) {
      secureMemoryClear(this.encryptionKey);
      this.encryptionKey = null;
    }

    this.isInitialized = false;
    console.log('[SourceCache] Cleanup completed');
  }
}

// Export singleton instance
export const sourceCacheManager = SourceCacheManager.getInstance();