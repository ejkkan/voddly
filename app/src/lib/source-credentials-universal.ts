/**
 * Universal source credentials manager
 * Works on: iOS, Android, Web, tvOS, Node.js
 */

'use client';

// Platform-agnostic imports only
import { 
  deriveKeyUniversal, 
  deriveKeyAsync,
  UniversalCryptoConfig 
} from './crypto-universal';

import {
  aesGcmDecrypt,
  decodeBase64,
  encodeBase64,
  xchacha20Poly1305Decrypt,
} from './crypto-utils';

// Conditional imports for platform-specific features
let MMKV: any = null;
let apiClient: any = null;
let passphraseCache: any = null;
let debugLog: any = () => {};
let getRegisteredPassphraseResolver: any = null;

// Try to import platform-specific modules
try {
  // These might not exist on all platforms
  const mmkvModule = require('react-native-mmkv');
  MMKV = mmkvModule.MMKV;
} catch {
  console.log('[SourceCredentials] MMKV not available on this platform');
}

try {
  apiClient = require('./api-client').apiClient;
} catch {
  console.log('[SourceCredentials] API client not available');
}

try {
  passphraseCache = require('./passphrase-cache').passphraseCache;
} catch {
  console.log('[SourceCredentials] Passphrase cache not available');
}

try {
  debugLog = require('./passphrase-debug').debugLog;
} catch {
  debugLog = (...args: any[]) => console.log('[Debug]', ...args);
}

try {
  getRegisteredPassphraseResolver = require('./passphrase-ui').getRegisteredPassphraseResolver;
} catch {
  console.log('[SourceCredentials] Passphrase UI not available');
}

// Types
export type SourceCredentials = {
  server: string;
  username: string;
  password: string;
  containerExtension?: string;
  videoCodec?: string;
  audioCodec?: string;
};

export type SourceInfo = {
  source: {
    id: string;
    name: string;
    encrypted_config: string;
    config_iv: string;
  };
  keyData: {
    master_key_wrapped: string;
    salt: string;
    iv: string;
    iterations?: number;
    kdf?: 'pbkdf2';
    wrap_algo?: 'aes-gcm-256' | 'xchacha20poly1305';
  };
  account: { id: string; name: string };
};

// Simple in-memory cache for platforms without MMKV
class SimpleCache {
  private cache = new Map<string, { value: string; expires: number }>();
  
  getString(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }
  
  set(key: string, value: string) {
    this.cache.set(key, {
      value,
      expires: Date.now() + (5 * 60 * 1000), // 5 minutes
    });
  }
}

// Storage abstraction
const storage = (() => {
  if (MMKV) {
    try {
      return new MMKV();
    } catch (e) {
      console.log('[Storage] MMKV init failed, using memory cache');
    }
  }
  return new SimpleCache();
})();

/**
 * Universal master key derivation with caching
 */
async function getOrDeriveMasterKeyUniversal(args: {
  accountId: string;
  passphrase: string;
  keyData: any;
  salt: Uint8Array;
  iv: Uint8Array;
  wrapped: Uint8Array;
  onProgress?: (progress: number) => void;
}): Promise<Uint8Array> {
  const { accountId, passphrase, keyData, salt, iv, wrapped, onProgress } = args;
  const cacheKeyPersist = `mk:${accountId}`;
  
  console.log(`[MasterKey] Deriving for account ${accountId} on ${UniversalCryptoConfig.platform}`);
  
  // Check persistent cache
  try {
    const packed = storage.getString?.(cacheKeyPersist);
    if (packed) {
      const obj = JSON.parse(packed) as { b64: string; exp: number };
      if (Date.now() < obj.exp) {
        const keyBytes = decodeBase64(obj.b64);
        console.log('[MasterKey] Using cached key');
        return keyBytes;
      }
    }
  } catch (e) {
    console.log('[MasterKey] Cache check failed:', e);
  }
  
  // Check memory cache
  const g = globalThis as any;
  g.__masterKeyCache = g.__masterKeyCache || new Map();
  const cacheKey = `acct:${accountId}`;
  const cached = g.__masterKeyCache.get(cacheKey);
  
  if (cached && cached.expiresAt > Date.now()) {
    console.log('[MasterKey] Using memory cache');
    return cached.key;
  }
  
  // Derive key using universal function
  console.log('[MasterKey] Starting key derivation...');
  
  const personalKeyBytes = await deriveKeyUniversal(
    passphrase,
    salt,
    {
      iterations: keyData.iterations || UniversalCryptoConfig.defaultIterations,
      onProgress,
    }
  );
  
  console.log('[MasterKey] Key derivation completed');
  
  // Decrypt master key
  let masterKeyBytes: Uint8Array;
  try {
    masterKeyBytes = aesGcmDecrypt(personalKeyBytes, iv, wrapped);
  } catch (e: any) {
    console.error('[MasterKey] Decryption failed:', e);
    throw new Error('Failed to decrypt master key: ' + (e?.message || e));
  }
  
  // Cache the result
  const now = Date.now();
  const ttl = 5 * 60 * 1000; // 5 minutes
  
  g.__masterKeyCache.set(cacheKey, {
    key: masterKeyBytes,
    expiresAt: now + ttl,
  });
  
  try {
    storage.set?.(
      cacheKeyPersist,
      JSON.stringify({
        b64: encodeBase64(masterKeyBytes),
        exp: now + ttl,
      })
    );
    console.log('[MasterKey] Cached for future use');
  } catch (e) {
    console.log('[MasterKey] Failed to persist cache:', e);
  }
  
  return masterKeyBytes;
}

/**
 * Universal source credentials manager
 */
export class UniversalSourceCredentialsManager {
  private getPassphrase: (accountId: string, options?: any) => Promise<string>;
  
  constructor(opts: {
    getPassphrase: (accountId: string, options?: any) => Promise<string>;
  }) {
    this.getPassphrase = opts.getPassphrase;
  }
  
  async findSourceInfo(sourceId: string): Promise<SourceInfo> {
    if (!apiClient) {
      throw new Error('API client not available on this platform');
    }
    
    const targetId = String(sourceId).split(':')[0];
    const accounts = await apiClient.user.getAccounts();
    
    for (const account of accounts.accounts || []) {
      try {
        const { sources, keyData } = await apiClient.user.getSources(account.id);
        const source = sources?.find((s: any) => 
          s.id === targetId || s.name === targetId
        );
        
        if (source && keyData) {
          return {
            source: {
              id: source.id,
              name: source.name,
              encrypted_config: source.encrypted_config,
              config_iv: source.config_iv,
            },
            keyData,
            account: { id: account.id, name: account.name },
          };
        }
      } catch {
        continue;
      }
    }
    
    throw new Error('Source not found');
  }
  
  async getSourceCredentials(
    sourceId: string,
    options?: {
      onProgress?: (progress: number) => void;
    }
  ): Promise<SourceCredentials> {
    console.log('[UniversalCredentials] Getting credentials for:', sourceId);
    const info = await this.findSourceInfo(sourceId);
    
    const passphrase = await this.getPassphrase(info.account.id, {
      accountName: info.account.name,
    });
    
    // Parse key data
    const salt = decodeBase64(info.keyData.salt);
    const iv = decodeBase64(info.keyData.iv);
    const wrapped = decodeBase64(info.keyData.master_key_wrapped);
    
    // Get master key
    const masterKeyBytes = await getOrDeriveMasterKeyUniversal({
      accountId: info.account.id,
      passphrase,
      keyData: info.keyData,
      salt,
      iv,
      wrapped,
      onProgress: options?.onProgress,
    });
    
    // Decrypt config
    const cfgIv = decodeBase64(info.source.config_iv);
    const cfgEnc = decodeBase64(info.source.encrypted_config);
    
    const alg = info.keyData.wrap_algo || 'aes-gcm-256';
    const plain = alg === 'xchacha20poly1305'
      ? xchacha20Poly1305Decrypt(masterKeyBytes, cfgIv, cfgEnc)
      : aesGcmDecrypt(masterKeyBytes, cfgIv, cfgEnc);
    
    return JSON.parse(new TextDecoder().decode(plain));
  }
}

/**
 * Universal hook that works on all platforms
 */
export function useSourceCredentialsUniversal() {
  return {
    getCredentials: async (
      sourceId: string,
      options?: {
        onProgress?: (progress: number) => void;
      }
    ): Promise<SourceCredentials> => {
      const manager = new UniversalSourceCredentialsManager({
        getPassphrase: async (accountId, opts) => {
          // Try cache first
          if (passphraseCache) {
            const cached = passphraseCache.get(accountId);
            if (cached) return cached;
          }
          
          // Get from resolver
          if (getRegisteredPassphraseResolver) {
            const resolver = getRegisteredPassphraseResolver();
            if (resolver) {
              return resolver(accountId, opts);
            }
          }
          
          // Fallback - you might want to throw or prompt differently
          throw new Error('Passphrase required but no resolver available');
        },
      });
      
      return manager.getSourceCredentials(sourceId, options);
    },
    
    // Platform info for debugging
    platformInfo: UniversalCryptoConfig,
  };
}