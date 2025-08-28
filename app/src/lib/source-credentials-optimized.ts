'use client';

import { MMKV } from 'react-native-mmkv';
import { apiClient } from '@/lib/api-client';
import {
  aesGcmDecrypt,
  decodeBase64,
  encodeBase64,
  xchacha20Poly1305Decrypt,
} from '@/lib/crypto-utils';
import { passphraseCache } from '@/lib/passphrase-cache';
import { debugLog } from '@/lib/passphrase-debug';
import { getRegisteredPassphraseResolver } from '@/lib/passphrase-ui';
import { 
  deriveKeyOptimized, 
  deriveKeyWithProgress,
  CryptoConfig 
} from '@/lib/crypto-performance-optimized';

// Types remain the same
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
    opslimit?: number;
    memlimit?: number;
    wrap_algo?: 'aes-gcm-256' | 'xchacha20poly1305';
  };
  account: { id: string; name: string };
};

export type SourceCredentialsOptions = {
  title?: string;
  message?: string;
  validatePassphrase?: (passphrase: string) => Promise<boolean>;
  onProgress?: (progress: number) => void; // New: progress callback
  useAsyncDerivation?: boolean; // New: control async behavior
};

const storage: MMKV | null = (() => {
  try {
    return new MMKV();
  } catch {
    return null;
  }
})();

export class SourceCredentialsManager {
  private readonly getPassphrase: (
    accountId: string,
    options?: {
      title?: string;
      message?: string;
      accountName?: string;
      validateFn?: (p: string) => Promise<boolean>;
    }
  ) => Promise<string>;

  constructor(opts: {
    getPassphrase: (
      accountId: string,
      options?: {
        title?: string;
        message?: string;
        accountName?: string;
        validateFn?: (p: string) => Promise<boolean>;
      }
    ) => Promise<string>;
  }) {
    this.getPassphrase = opts.getPassphrase;
  }

  async findSourceInfo(sourceId: string): Promise<SourceInfo> {
    const targetId = String(sourceId).split(':')[0];
    return resolveSourceInfo(targetId);
  }

  async getSourceCredentials(
    sourceId: string,
    options: SourceCredentialsOptions = {}
  ): Promise<SourceCredentials> {
    console.log('[SourceCredentialsManager] getSourceCredentials called for:', sourceId);
    const info = await this.findSourceInfo(sourceId);

    try {
      console.log('[SourceCredentialsManager] Found source info, attempting to get credentials...');
      const result = await this.attemptGetCredentials(info, options);
      console.log('[SourceCredentialsManager] attemptGetCredentials completed successfully');
      return result;
    } catch {
      console.log('[SourceCredentialsManager] First attempt failed, retrying...');
      // Clear caches on failure
      try {
        passphraseCache.remove(info.account.id);
      } catch {}
      try {
        const g = globalThis as any;
        if (g.__masterKeyCache) g.__masterKeyCache.delete(`acct:${info.account.id}`);
      } catch {}
      const result = await this.attemptGetCredentials(info, options);
      console.log('[SourceCredentialsManager] Retry attemptGetCredentials completed successfully');
      return result;
    }
  }

  async decryptSourceConfigWithKey(
    info: SourceInfo,
    masterKeyBytes: Uint8Array
  ): Promise<SourceCredentials> {
    const cfgIv = decodeBase64(String(info.source.config_iv || ''));
    const cfgEnc = decodeBase64(String(info.source.encrypted_config || ''));
    
    if (cfgIv.length === 0) throw new Error('Invalid source config: missing IV');
    if (cfgIv.length !== 12 && cfgIv.length !== 24)
      throw new Error(`Invalid source config: IV must be 12 or 24 bytes, got ${cfgIv.length}`);
    if (cfgEnc.length === 0) throw new Error('Invalid source config: missing encrypted payload');

    try {
      const alg = String(info.keyData.wrap_algo || 'aes-gcm-256');
      const plain =
        alg === 'xchacha20poly1305'
          ? xchacha20Poly1305Decrypt(masterKeyBytes, cfgIv, cfgEnc)
          : aesGcmDecrypt(masterKeyBytes, cfgIv, cfgEnc);
      
      const credentials = JSON.parse(new TextDecoder().decode(new Uint8Array(plain)));
      return credentials as SourceCredentials;
    } catch (err: any) {
      debugLog('decryptSourceConfigWithKey:error', String(err?.message || err));
      throw new Error('Failed to decrypt source config: ' + String(err?.message || err));
    }
  }

  private async attemptGetCredentials(
    info: SourceInfo,
    options: SourceCredentialsOptions
  ): Promise<SourceCredentials> {
    console.log('[SourceCredentialsManager] attemptGetCredentials starting...');
    
    const passphrase = await this.getPassphrase(info.account.id, {
      title: options.title || 'Decrypt Source',
      message: options.message || 'Enter your passphrase to decrypt the source',
      accountName: info.account.name,
      validateFn: options.validatePassphrase,
    });
    
    console.log('[SourceCredentialsManager] Passphrase obtained, deriving master key...');

    const { salt, iv, wrapped } = validateAndParseKeyData(info.keyData);
    console.log('[SourceCredentialsManager] Key data parsed, calling optimized key derivation...');
    
    const masterKeyBytes = await getOrDeriveMasterKeyOptimized({
      accountId: info.account.id,
      passphrase,
      keyData: info.keyData,
      salt,
      iv,
      wrapped,
      onProgress: options.onProgress,
      useAsync: options.useAsyncDerivation,
    });
    
    console.log('[SourceCredentialsManager] Master key derived, validating source config...');
    validateSourceConfig(info.source);
    console.log('[SourceCredentialsManager] Source config validated, decrypting...');
    
    const creds = await this.decryptSourceConfigWithKey(info, masterKeyBytes);
    console.log('[SourceCredentialsManager] Decryption completed successfully');
    return creds;
  }
}

// Optimized key derivation with caching
async function getOrDeriveMasterKeyOptimized(args: {
  accountId: string;
  passphrase: string;
  keyData: any;
  salt: Uint8Array;
  iv: Uint8Array;
  wrapped: Uint8Array;
  onProgress?: (progress: number) => void;
  useAsync?: boolean;
}): Promise<Uint8Array> {
  console.log('[getOrDeriveMasterKey] Starting for account:', args.accountId);
  const { accountId, passphrase, keyData, salt, iv, wrapped, onProgress, useAsync } = args;
  const cacheKeyPersist = `mk:${accountId}`;
  
  debugLog('getOrDeriveMasterKey:start', { accountId });
  
  // Check persistent cache first
  try {
    const packed = storage?.getString(cacheKeyPersist);
    if (packed) {
      const obj = JSON.parse(packed) as { b64: string; exp: number };
      if (Date.now() < obj.exp) {
        const keyBytes = decodeBase64(obj.b64);
        console.log('[getOrDeriveMasterKey] Using persisted cache');
        debugLog('getOrDeriveMasterKey:hitPersistedCache');
        return keyBytes;
      }
    }
  } catch {}
  
  // Check memory cache
  type CacheEntry = { key: Uint8Array; expiresAt: number };
  const MASTER_KEY_CACHE_TTL_MS = 5 * 60 * 1000;
  const g = globalThis as any;
  g.__masterKeyCache = g.__masterKeyCache || new Map<string, CacheEntry>();
  const cacheKey = `acct:${accountId}`;
  const nowTs = Date.now();
  const cached: CacheEntry | undefined = g.__masterKeyCache.get(cacheKey);
  
  if (cached && cached.expiresAt > nowTs) {
    console.log('[getOrDeriveMasterKey] Using memory cache');
    debugLog('getOrDeriveMasterKey:hitMemoryCache');
    return cached.key;
  }
  
  // Use optimized key derivation
  console.log('[getOrDeriveMasterKey] No cache hit, starting optimized key derivation...');
  
  let personalKeyBytes: Uint8Array;
  
  // Use progress callback if provided
  if (onProgress) {
    personalKeyBytes = await deriveKeyWithProgress(
      passphrase,
      salt,
      onProgress,
      keyData.iterations || CryptoConfig.mobileIterations
    );
  } else {
    // Use standard optimized derivation
    personalKeyBytes = await deriveKeyOptimized(
      passphrase,
      salt,
      { 
        iterations: keyData.iterations || CryptoConfig.mobileIterations,
        useAsync: useAsync !== false // Default to async on mobile
      }
    );
  }
  
  console.log('[getOrDeriveMasterKey] Key derivation completed');

  // Decrypt master key
  let masterKeyBytes: Uint8Array;
  try {
    masterKeyBytes = aesGcmDecrypt(personalKeyBytes, iv, wrapped);
  } catch (e: any) {
    debugLog('getOrDeriveMasterKey:aesGcm:error', String(e?.message || e));
    throw e;
  }
  
  console.log('[getOrDeriveMasterKey] Master key decryption completed');
  debugLog('getOrDeriveMasterKey:derived');
  
  // Cache the result
  g.__masterKeyCache.set(cacheKey, {
    key: masterKeyBytes,
    expiresAt: nowTs + MASTER_KEY_CACHE_TTL_MS,
  });
  
  try {
    storage?.set(
      cacheKeyPersist,
      JSON.stringify({
        b64: encodeBase64(masterKeyBytes),
        exp: nowTs + MASTER_KEY_CACHE_TTL_MS,
      })
    );
    console.log('[getOrDeriveMasterKey] Cached to persistent storage');
    debugLog('getOrDeriveMasterKey:persisted');
  } catch {}
  
  return masterKeyBytes;
}

// Helper functions (unchanged)
async function resolveSourceInfo(targetId: string): Promise<SourceInfo> {
  debugLog('resolveSourceInfo:start', { targetId });
  const accounts = await apiClient.user.getAccounts();
  
  for (const account of accounts.accounts || []) {
    try {
      debugLog('resolveSourceInfo:checkingAccount', { accountId: account.id });
      const { sources, keyData } = await apiClient.user.getSources(account.id);
      const list = sources || [];
      debugLog('resolveSourceInfo:sourcesFetched', {
        count: list.length,
        hasKeyData: !!keyData,
      });
      
      const source = list.find((s) => s.id === targetId || s.name === targetId);
      if (source && keyData) {
        debugLog('resolveSourceInfo:foundExactSource', { sourceId: source.id });
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
      
      if (!source && keyData && list.length === 1) {
        const only = list[0];
        debugLog('resolveSourceInfo:defaultingSingleSource', { sourceId: only.id });
        return {
          source: {
            id: only.id,
            name: only.name,
            encrypted_config: only.encrypted_config,
            config_iv: only.config_iv,
          },
          keyData,
          account: { id: account.id, name: account.name },
        };
      }
    } catch {
      debugLog('resolveSourceInfo:errorFetchingAccount', { accountId: account.id });
      continue;
    }
  }
  
  debugLog('resolveSourceInfo:notFound');
  throw new Error('Source not found in any account');
}

function validateAndParseKeyData(keyData: SourceInfo['keyData']): {
  salt: Uint8Array;
  iv: Uint8Array;
  wrapped: Uint8Array;
} {
  debugLog('validateAndParseKeyData:start');
  const salt = decodeBase64(String(keyData.salt || ''));
  const iv = decodeBase64(String(keyData.iv || ''));
  const wrapped = decodeBase64(String(keyData.master_key_wrapped || ''));
  
  if (salt.length === 0) throw new Error('Invalid key data: missing salt');
  if (iv.length === 0) throw new Error('Invalid key data: missing IV');
  if (iv.length !== 12 && iv.length !== 24)
    throw new Error(`Invalid key data: IV must be 12 or 24 bytes, got ${iv.length}`);
  if (wrapped.length === 0) throw new Error('Invalid key data: missing wrapped key');
  
  debugLog('validateAndParseKeyData:ok', {
    saltLen: salt.length,
    ivLen: iv.length,
    wrappedLen: wrapped.length,
  });
  
  return { salt, iv, wrapped };
}

function validateSourceConfig(source: SourceInfo['source']): void {
  const cfgIv = decodeBase64(String(source.config_iv || ''));
  const cfgEnc = decodeBase64(String(source.encrypted_config || ''));
  
  if (cfgIv.length === 0) throw new Error('Invalid source config: missing IV');
  if (cfgIv.length !== 12 && cfgIv.length !== 24)
    throw new Error(`Invalid source config: IV must be 12 or 24 bytes, got ${cfgIv.length}`);
  if (cfgEnc.length === 0) throw new Error('Invalid source config: missing encrypted payload');
  
  debugLog('validateSourceConfig:ok', {
    ivLen: cfgIv.length,
    encLen: cfgEnc.length,
  });
}

// Export hook with optimizations
export function useSourceCredentialsOptimized() {
  return {
    getCredentials: async (
      sourceId: string,
      options?: SourceCredentialsOptions
    ): Promise<SourceCredentials> => {
      const manager = new SourceCredentialsManager({
        getPassphrase: async (accountId, opts) => {
          const cached = passphraseCache.get(accountId);
          if (cached) return cached;
          
          const resolver = getRegisteredPassphraseResolver();
          if (!resolver) throw new Error('Passphrase required');
          
          const p = await resolver(accountId, {
            title: opts?.title,
            message: opts?.message,
            accountName: opts?.accountName,
          });
          
          return p;
        },
      });
      
      return manager.getSourceCredentials(sourceId, options);
    },
    
    prepareContentPlayback: async (args: {
      sourceId: string;
      contentId: string | number;
      contentType: 'movie' | 'series' | 'live';
      options?: SourceCredentialsOptions;
    }) => {
      const { sourceId, contentId, contentType, options } = args;
      
      const creds = await new SourceCredentialsManager({
        getPassphrase: async (accountId, opts) => {
          const cached = passphraseCache.get(accountId);
          if (cached) return cached;
          
          const resolver = getRegisteredPassphraseResolver();
          if (!resolver) throw new Error('Passphrase required');
          
          const p = await resolver(accountId, {
            title: opts?.title,
            message: opts?.message,
            accountName: opts?.accountName,
          });
          
          return p;
        },
      }).getSourceCredentials(sourceId, options);
      
      return { credentials: creds, sourceId, contentId, contentType };
    },
  };
}