/**
 * Super simple source credentials wrapper
 * Handles caching and passphrase popup seamlessly
 */

import { useSourceCredentials } from './source-credentials';

/**
 * Simple hook that handles everything automatically
 * - Caches passphrases for 30 minutes
 * - Caches derived keys for 30 minutes  
 * - Shows popup when needed
 * - No CPU spikes after first derivation
 */
export function useSimpleSourceCredentials() {
  const { getCredentials, prepareContentPlayback } = useSourceCredentials();
  
  return {
    /**
     * Get credentials for a source
     * First time: ~1 second derivation
     * Subsequent calls: instant (cached)
     */
    getCredentials: async (sourceId: string) => {
      try {
        // This will automatically:
        // 1. Check cache first
        // 2. Show passphrase popup if needed
        // 3. Derive key (1000 iterations - fast)
        // 4. Cache everything for 30 minutes
        return await getCredentials(sourceId);
      } catch (error) {
        console.error('[SimpleCredentials] Failed to get credentials:', error);
        throw error;
      }
    },
    
    /**
     * Prepare playback with credentials
     * Handles all the same caching automatically
     */
    preparePlayback: async (
      sourceId: string,
      contentId: string | number,
      contentType: 'movie' | 'series' | 'live'
    ) => {
      try {
        return await prepareContentPlayback({
          sourceId,
          contentId,
          contentType,
        });
      } catch (error) {
        console.error('[SimpleCredentials] Failed to prepare playback:', error);
        throw error;
      }
    },
    
    /**
     * Clear all caches (for logout)
     */
    clearCache: () => {
      try {
        // Clear global cache
        const g = globalThis as any;
        if (g.__masterKeyCache) {
          g.__masterKeyCache.clear();
        }
        
        // Clear passphrase cache
        const { passphraseCache } = require('./passphrase-cache');
        passphraseCache.clear();
        
        console.log('[SimpleCredentials] Cache cleared');
      } catch (error) {
        console.error('[SimpleCredentials] Failed to clear cache:', error);
      }
    },
  };
}

// Export a singleton instance for even simpler usage
export const simpleCredentials = {
  get: async (sourceId: string) => {
    const { getCredentials } = useSimpleSourceCredentials();
    return getCredentials(sourceId);
  },
  
  preparePlayback: async (
    sourceId: string,
    contentId: string | number,
    contentType: 'movie' | 'series' | 'live'
  ) => {
    const { preparePlayback } = useSimpleSourceCredentials();
    return preparePlayback(sourceId, contentId, contentType);
  },
  
  clearCache: () => {
    const { clearCache } = useSimpleSourceCredentials();
    clearCache();
  },
};

/**
 * Performance characteristics:
 * - First derivation: ~1 second (1000 PBKDF2 iterations)
 * - Cached calls: <1ms
 * - Cache duration: 30 minutes
 * - Memory usage: minimal (just stores 32-byte keys)
 * - CPU after cache: 0% (no computation needed)
 */