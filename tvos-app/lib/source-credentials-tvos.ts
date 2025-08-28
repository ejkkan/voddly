/**
 * Source credentials manager for tvOS
 * Simplified version without MMKV (uses AsyncStorage instead)
 */

'use client';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import {
  aesGcmDecrypt,
  decodeBase64,
  encodeBase64,
  xchacha20Poly1305Decrypt,
} from './crypto-utils';

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

// Simple debug logging
const debugLog = (message: string, data?: any) => {
  if (__DEV__) {
    console.log(`[SourceCredentials] ${message}`, data || '');
  }
};

// Passphrase cache (in-memory for tvOS)
class PassphraseCache {
  private cache = new Map<string, { passphrase: string; expiresAt: number }>();
  private readonly TTL = 30 * 60 * 1000; // 30 minutes

  set(accountId: string, passphrase: string) {
    this.cache.set(accountId, {
      passphrase,
      expiresAt: Date.now() + this.TTL,
    });
  }

  get(accountId: string): string | null {
    const entry = this.cache.get(accountId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(accountId);
      return null;
    }
    return entry.passphrase;
  }

  clear() {
    this.cache.clear();
  }
}

const passphraseCache = new PassphraseCache();

// Master key cache
type MasterKeyCache = Map<string, { key: Uint8Array; expiresAt: number }>;
const masterKeyCache: MasterKeyCache = new Map();
const MASTER_KEY_TTL = 30 * 60 * 1000; // 30 minutes

// Key derivation (optimized for tvOS - low iterations)
async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = 1000 // Low for tvOS performance
): Promise<Uint8Array> {
  debugLog('deriveKey:start', { iterations });
  
  const result = pbkdf2(sha256, passphrase, salt, {
    c: iterations,
    dkLen: 32,
  });
  
  debugLog('deriveKey:done');
  return result;
}

// Get or derive master key with caching
async function getOrDeriveMasterKey(args: {
  accountId: string;
  passphrase: string;
  keyData: any;
  salt: Uint8Array;
  iv: Uint8Array;
  wrapped: Uint8Array;
}): Promise<Uint8Array> {
  const { accountId, passphrase, keyData, salt, iv, wrapped } = args;
  
  // Check memory cache first
  const cacheKey = `acct:${accountId}`;
  const cached = masterKeyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    debugLog('getOrDeriveMasterKey:cache-hit');
    return cached.key;
  }
  
  // Check AsyncStorage cache
  try {
    const stored = await AsyncStorage.getItem(`mk:${accountId}`);
    if (stored) {
      const { b64, exp } = JSON.parse(stored);
      if (Date.now() < exp) {
        const keyBytes = decodeBase64(b64);
        // Update memory cache
        masterKeyCache.set(cacheKey, {
          key: keyBytes,
          expiresAt: exp,
        });
        debugLog('getOrDeriveMasterKey:storage-hit');
        return keyBytes;
      }
    }
  } catch (e) {
    debugLog('getOrDeriveMasterKey:storage-error', e);
  }
  
  // Derive key
  debugLog('getOrDeriveMasterKey:deriving');
  const iterations = keyData.iterations || 1000; // Low for tvOS
  const personalKeyBytes = await deriveKey(passphrase, salt, iterations);
  
  // Decrypt master key
  const masterKeyBytes = aesGcmDecrypt(personalKeyBytes, iv, wrapped);
  
  // Cache in memory
  const expiresAt = Date.now() + MASTER_KEY_TTL;
  masterKeyCache.set(cacheKey, {
    key: masterKeyBytes,
    expiresAt,
  });
  
  // Cache in AsyncStorage
  try {
    await AsyncStorage.setItem(
      `mk:${accountId}`,
      JSON.stringify({
        b64: encodeBase64(masterKeyBytes),
        exp: expiresAt,
      })
    );
  } catch (e) {
    debugLog('getOrDeriveMasterKey:storage-save-error', e);
  }
  
  return masterKeyBytes;
}

// Main credentials manager
export class SourceCredentialsManager {
  constructor(
    private getPassphrase: (
      accountId: string,
      options?: any
    ) => Promise<string>
  ) {}
  
  async getSourceCredentials(
    info: SourceInfo,
    passphrase?: string
  ): Promise<SourceCredentials> {
    debugLog('getSourceCredentials:start', { sourceId: info.source.id });
    
    // Get passphrase (from param or prompt)
    const pass = passphrase || (await this.getPassphrase(info.account.id, {
      accountName: info.account.name,
    }));
    
    // Cache passphrase
    passphraseCache.set(info.account.id, pass);
    
    // Parse key data
    const salt = decodeBase64(info.keyData.salt);
    const iv = decodeBase64(info.keyData.iv);
    const wrapped = decodeBase64(info.keyData.master_key_wrapped);
    
    // Get master key (cached or derived)
    const masterKeyBytes = await getOrDeriveMasterKey({
      accountId: info.account.id,
      passphrase: pass,
      keyData: info.keyData,
      salt,
      iv,
      wrapped,
    });
    
    // Decrypt config
    const cfgIv = decodeBase64(info.source.config_iv);
    const cfgEnc = decodeBase64(info.source.encrypted_config);
    
    const alg = info.keyData.wrap_algo || 'aes-gcm-256';
    const plain = alg === 'xchacha20poly1305'
      ? xchacha20Poly1305Decrypt(masterKeyBytes, cfgIv, cfgEnc)
      : aesGcmDecrypt(masterKeyBytes, cfgIv, cfgEnc);
    
    const credentials = JSON.parse(new TextDecoder().decode(plain));
    debugLog('getSourceCredentials:success');
    
    return credentials as SourceCredentials;
  }
}

// Simple hook for tvOS
export function useSourceCredentialsTVOS() {
  return {
    getCredentials: async (
      sourceInfo: SourceInfo,
      passphrase?: string
    ): Promise<SourceCredentials> => {
      // Check cache first
      const cachedPass = passphrase || passphraseCache.get(sourceInfo.account.id);
      
      const manager = new SourceCredentialsManager(async (accountId, opts) => {
        // If we have a cached passphrase, use it
        if (cachedPass) return cachedPass;
        
        // Otherwise, you need to implement a TV-friendly passphrase prompt
        // For now, throw an error
        throw new Error('Passphrase required - implement TV input UI');
      });
      
      return manager.getSourceCredentials(sourceInfo, cachedPass || undefined);
    },
    
    clearCache: async () => {
      passphraseCache.clear();
      masterKeyCache.clear();
      
      // Clear AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      const mkKeys = keys.filter(k => k.startsWith('mk:'));
      if (mkKeys.length > 0) {
        await AsyncStorage.multiRemove(mkKeys);
      }
      
      debugLog('clearCache:done');
    },
  };
}

// Export singleton for easy use
export const tvosCredentials = {
  get: async (sourceInfo: SourceInfo, passphrase?: string) => {
    const { getCredentials } = useSourceCredentialsTVOS();
    return getCredentials(sourceInfo, passphrase);
  },
  
  clearCache: async () => {
    const { clearCache } = useSourceCredentialsTVOS();
    return clearCache();
  },
};