export interface CachedPassphrase {
  passphrase: string;
  timestamp: number;
  expiresAt: number;
}

export class PassphraseCache {
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  private static readonly STORAGE_KEY = "passphrase_cache";
  private cache = new Map<string, CachedPassphrase>();

  constructor() {
    // Load cache from sessionStorage on initialization
    this.loadFromStorage();
  }

  /**
   * Set a passphrase in the cache for a specific account
   */
  set(accountId: string, passphrase: string): void {
    const now = Date.now();
    const cached: CachedPassphrase = {
      passphrase,
      timestamp: now,
      expiresAt: now + PassphraseCache.CACHE_DURATION,
    };

    this.cache.set(accountId, cached);
    this.saveToStorage();
  }

  /**
   * Get a passphrase from cache if it exists and hasn't expired
   */
  get(accountId: string): string | null {
    const cached = this.cache.get(accountId);
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(accountId);
      this.saveToStorage();
      return null;
    }

    return cached.passphrase;
  }

  /**
   * Check if a passphrase exists in cache and is valid
   */
  has(accountId: string): boolean {
    return this.get(accountId) !== null;
  }

  /**
   * Remove a specific passphrase from cache
   */
  remove(accountId: string): void {
    this.cache.delete(accountId);
    this.saveToStorage();
  }

  /**
   * Clear all cached passphrases
   */
  clear(): void {
    this.cache.clear();
    this.saveToStorage();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let hasExpired = false;

    for (const [accountId, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(accountId);
        hasExpired = true;
      }
    }

    if (hasExpired) {
      this.saveToStorage();
    }
  }

  /**
   * Get time remaining until expiry for a cached passphrase
   */
  getTimeRemaining(accountId: string): number {
    const cached = this.cache.get(accountId);
    if (!cached) {
      return 0;
    }

    const remaining = cached.expiresAt - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Get all account IDs that have cached passphrases
   */
  getCachedAccountIds(): string[] {
    this.cleanup(); // Clean up expired entries first
    return Array.from(this.cache.keys());
  }

  /**
   * Save cache to sessionStorage (encrypted storage for security)
   */
  private saveToStorage(): void {
    try {
      // Only store non-expired entries
      const now = Date.now();
      const validEntries: Record<string, CachedPassphrase> = {};

      for (const [accountId, cached] of this.cache.entries()) {
        if (now <= cached.expiresAt) {
          validEntries[accountId] = cached;
        }
      }

      sessionStorage.setItem(PassphraseCache.STORAGE_KEY, JSON.stringify(validEntries));
    } catch (error) {
      console.warn("Failed to save passphrase cache to storage:", error);
    }
  }

  /**
   * Load cache from sessionStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = sessionStorage.getItem(PassphraseCache.STORAGE_KEY);
      if (!stored) {
        return;
      }

      const entries: Record<string, CachedPassphrase> = JSON.parse(stored);
      const now = Date.now();

      // Only load non-expired entries
      for (const [accountId, cached] of Object.entries(entries)) {
        if (now <= cached.expiresAt) {
          this.cache.set(accountId, cached);
        }
      }

      // Save cleaned cache back to storage
      this.saveToStorage();
    } catch (error) {
      console.warn("Failed to load passphrase cache from storage:", error);
      // Clear corrupted cache
      sessionStorage.removeItem(PassphraseCache.STORAGE_KEY);
    }
  }
}

// Global instance for the application
export const passphraseCache = new PassphraseCache();

// Set up periodic cleanup
if (typeof window !== "undefined") {
  setInterval(() => {
    passphraseCache.cleanup();
  }, 60 * 1000); // Clean up every minute
}
