'use client';

import { MMKV } from 'react-native-mmkv';

import { apiClient } from '@/lib/api-client';
import { deriveKeyUnified } from '@/lib/crypto-unified';
import {
  aesGcmDecrypt,
  decodeBase64,
  encodeBase64,
  xchacha20Poly1305Decrypt,
} from '@/lib/crypto-utils';
import { DeviceManager } from '@/lib/device-manager';
import { passphraseCache } from '@/lib/passphrase-cache';
import { debugLog } from '@/lib/passphrase-debug';
import { getRegisteredPassphraseResolver } from '@/lib/passphrase-ui';

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
    kdf_iterations?: number; // Should always be 500000
    server_wrapped_key?: string; // Server-side encryption
    server_iv?: string; // Server-side encryption IV
    // Legacy fields (kept for compatibility during transition)
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
  onProgress?: (progress: number, message?: string) => void;
};

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
    return resolveSourceInfoDirect(targetId);
  }

  async getSourceCredentials(
    sourceId: string,
    options: SourceCredentialsOptions = {}
  ): Promise<SourceCredentials> {
    console.log(
      '[SourceCredentialsManager] getSourceCredentials called for:',
      sourceId
    );
    const info = await this.findSourceInfo(sourceId);

    try {
      console.log(
        '[SourceCredentialsManager] Found source info, attempting to get credentials...'
      );
      const result = await this.attemptGetCredentials(info, options);
      console.log(
        '[SourceCredentialsManager] attemptGetCredentials completed successfully'
      );
      return result;
    } catch {
      console.log(
        '[SourceCredentialsManager] First attempt failed, retrying...'
      );
      try {
        passphraseCache.remove(info.account.id);
      } catch {}
      try {
        const g = globalThis as any;
        if (g.__masterKeyCache)
          g.__masterKeyCache.delete(`acct:${info.account.id}`);
      } catch {}
      const result = await this.attemptGetCredentials(info, options);
      console.log(
        '[SourceCredentialsManager] Retry attemptGetCredentials completed successfully'
      );
      return result;
    }
  }
  // Helper to decrypt config JSON given an unwrapped master key
  async decryptSourceConfigWithKey(
    info: SourceInfo,
    masterKeyBytes: Uint8Array
  ): Promise<SourceCredentials> {
    const cfgIv = decodeBase64(String(info.source.config_iv || ''));
    const cfgEnc = decodeBase64(String(info.source.encrypted_config || ''));
    if (cfgIv.length === 0)
      throw new Error('Invalid source config: missing IV');
    // Accept 12-byte (GCM) and 24-byte (XChaCha20) nonces
    if (cfgIv.length !== 12 && cfgIv.length !== 24)
      throw new Error(
        `Invalid source config: IV must be 12 or 24 bytes, got ${cfgIv.length}`
      );
    if (cfgEnc.length === 0)
      throw new Error('Invalid source config: missing encrypted payload');
    // minimal logging removed
    try {
      const alg = String(info.keyData.wrap_algo || 'aes-gcm-256');

      const plain =
        alg === 'xchacha20poly1305'
          ? xchacha20Poly1305Decrypt(masterKeyBytes, cfgIv, cfgEnc)
          : aesGcmDecrypt(masterKeyBytes, cfgIv, cfgEnc);
      const credentials = JSON.parse(
        new TextDecoder().decode(new Uint8Array(plain))
      );
      return credentials as SourceCredentials;
    } catch (err: any) {
      // no verbose logging
      debugLog('decryptSourceConfigWithKey:error', String(err?.message || err));
      throw new Error(
        'Failed to decrypt source config: ' + String(err?.message || err)
      );
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
    console.log(
      '[SourceCredentialsManager] Passphrase obtained, deriving master key...'
    );

    const { salt, iv, wrapped } = validateAndParseKeyData(info.keyData);
    console.log(
      '[SourceCredentialsManager] Key data parsed, calling getOrDeriveMasterKey...'
    );
    const masterKeyBytes = await getOrDeriveMasterKey({
      accountId: info.account.id,
      passphrase,
      keyData: info.keyData,
      salt,
      iv,
      wrapped,
      onProgress: options.onProgress,
    });
    console.log(
      '[SourceCredentialsManager] Master key derived, validating source config...'
    );
    validateSourceConfig(info.source);
    console.log(
      '[SourceCredentialsManager] Source config validated, decrypting...'
    );
    const creds = await this.decryptSourceConfigWithKey(info, masterKeyBytes);
    console.log('[SourceCredentialsManager] Decryption completed successfully');
    return creds;
  }
}

// Helpers split out for readability and testability

// Cached version that can be used in React components
export async function resolveSourceInfoCached(
  targetId: string,
  accountsData?: any,
  sourcesData?: any,
  keyData?: any
): Promise<SourceInfo> {
  debugLog('resolveSourceInfoCached:start', { targetId });

  // If we have cached data, use it
  if (accountsData && sourcesData) {
    // Check if we have any accounts
    if (!accountsData.accounts || accountsData.accounts.length === 0) {
      debugLog('resolveSourceInfoCached:noAccounts');
      throw new Error('No accounts found. Please set up an account first.');
    }
    
    for (const account of accountsData.accounts || []) {
      const list = sourcesData.sources || [];
      
      // If no sources but we have keyData, it might be a configuration issue
      if (list.length === 0 && keyData) {
        debugLog('resolveSourceInfoCached:noSourcesButHasKeyData');
        throw new Error('No sources configured for your account. Please add a source in settings.');
      }
      
      // First try exact match
      let source = list.find(
        (s: any) => s.id === targetId || s.name === targetId
      );
      
      // If no exact match and we have sources, try to be more flexible
      if (!source && list.length > 0) {
        // Check if targetId contains a colon (like "source1:movie:123")
        // and try to match the prefix
        if (targetId.includes(':')) {
          const prefix = targetId.split(':')[0];
          source = list.find((s: any) => s.id === prefix || s.name === prefix);
        }
        
        // If still no match and there's only one source, use it
        if (!source && list.length === 1) {
          source = list[0];
        }
      }
      
      if (source && keyData) {
        debugLog('resolveSourceInfoCached:foundSource', {
          sourceId: source.id,
        });
        return {
          source: {
            id: source.id,
            name: source.name,
            encrypted_config: source.encrypted_config,
            config_iv: source.config_iv,
          },
          keyData: keyData,
          account: { id: account.id, name: account.name },
        };
      }
    }
  }

  // Fall back to the original function if no cached data
  return resolveSourceInfoDirect(targetId);
}

async function resolveSourceInfoDirect(targetId: string): Promise<SourceInfo> {
  console.log('[resolveSourceInfoDirect] Starting with targetId:', targetId);
  debugLog('resolveSourceInfo:start', { targetId });
  const subscriptions = await apiClient.user.getSubscriptions();
  console.log('[resolveSourceInfoDirect] Subscriptions response:', subscriptions);
  
  // Check if we have any subscriptions
  if (!subscriptions.subscriptions || subscriptions.subscriptions.length === 0) {
    debugLog('resolveSourceInfo:noSubscriptions');
    throw new Error('No subscription found. Please set up a subscription first.');
  }
  
  for (const account of subscriptions.subscriptions || []) {
    try {
      debugLog('resolveSourceInfo:checkingAccount', { accountId: account.id });
      console.log('[resolveSourceInfoDirect] About to call apiClient.user.getSources()');
      
      let sources, keyData;
      try {
        console.log('[resolveSourceInfoDirect] Calling getSources API...');
        const response = await apiClient.user.getSources({});
        sources = response.sources;
        console.log('[resolveSourceInfoDirect] getSources API call succeeded');
        
        // Fetch keyData separately for security
        console.log('[resolveSourceInfoDirect] Calling getSourceDecryptionKeys API...');
        const keysResponse = await apiClient.user.getSourceDecryptionKeys({});
        keyData = keysResponse.keyData;
        console.log('[resolveSourceInfoDirect] getSourceDecryptionKeys API call succeeded');
      } catch (apiError) {
        console.error('[resolveSourceInfoDirect] API call failed:', apiError);
        throw apiError;
      }
      
      const list = sources || [];
      console.log('[resolveSourceInfoDirect] Sources response:', { 
        sources: list, 
        keyData: !!keyData,
        sourceIds: list.map(s => s.id),
        sourceNames: list.map(s => s.name)
      });
      debugLog('resolveSourceInfo:sourcesFetched', {
        count: list.length,
        hasKeyData: !!keyData,
      });
      
      // If no sources but we have keyData, it might be a configuration issue
      if (list.length === 0 && keyData) {
        debugLog('resolveSourceInfo:noSourcesButHasKeyData');
        throw new Error('No sources configured for your account. Please add a source in settings.');
      }
      
      // First try exact match
      let source = list.find((s) => s.id === targetId || s.name === targetId);
      console.log('[resolveSourceInfoDirect] Looking for targetId:', targetId, 'Found:', source);
      
      // If no exact match and we have sources, try to be more flexible
      if (!source && list.length > 0) {
        // Check if targetId contains a colon (like "source1:movie:123")
        // and try to match the prefix
        if (targetId.includes(':')) {
          const prefix = targetId.split(':')[0];
          console.log('[resolveSourceInfoDirect] Trying prefix match with:', prefix);
          source = list.find((s) => s.id === prefix || s.name === prefix);
        }
        
        // If still no match and there's only one source, use it
        if (!source && list.length === 1) {
          source = list[0];
          console.log('[resolveSourceInfoDirect] Using single available source:', source.id);
        }
      }
      
      if (source && keyData) {
        debugLog('resolveSourceInfo:foundSource', { sourceId: source.id });
        console.log('[resolveSourceInfoDirect] Found source match:', source.id);
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
      
      console.log('[resolveSourceInfoDirect] No source found matching criteria');
    } catch (error) {
      console.error('[resolveSourceInfoDirect] Error fetching account:', error);
      debugLog('resolveSourceInfo:errorFetchingAccount', {
        accountId: account.id,
        error: String(error),
      });
      continue;
    }
  }
  debugLog('resolveSourceInfo:notFound');
  console.error('[resolveSourceInfoDirect] Source not found in any account');
  throw new Error('Source not found in any account. Please check your source configuration.');
}

async function deriveLightweightKey(
  passphrase: string,
  salt: Uint8Array,
  keyData: { iterations?: number; kdf_iterations?: number },
  onProgress?: (progress: number, message?: string) => void,
  accountId?: string
): Promise<Uint8Array> {
  if (salt.length !== 16) throw new Error('invalid salt length');

  try {
    debugLog('deriveLightweightKey:start', { saltLen: salt.length });

    // Check if we have device-specific key data
    if (accountId) {
      const deviceManager = DeviceManager.getInstance();
      const deviceKeyData = await deviceManager.getDeviceKeyData(accountId);

      if (deviceKeyData) {
        if (!deviceKeyData.kdf_iterations) {
          // Old cache without iterations - clear it
          console.log(
            '[Crypto] Device key missing iterations, clearing cache...'
          );
          deviceManager.clearDeviceRegistration(accountId);
          // Fall through to re-register
        } else {
          // Use device-specific iterations
          const iterations = deviceKeyData.kdf_iterations;
          console.log(
            `[Crypto] Using device-specific iterations: ${iterations}`
          );

          const deviceSalt = decodeBase64(deviceKeyData.salt);
          const result = await deriveKeyUnified(
            passphrase,
            deviceSalt,
            iterations,
            onProgress
          );

          debugLog('deriveLightweightKey:done:device', {
            resultLength: result.length,
            iterations,
          });

          return result;
        }
      }

      // If we get here, either no device key or invalid cache - register device
      if (accountId) {
        console.log('[Crypto] Registering device...');
        onProgress?.(0, 'Registering device...');

        try {
          const registeredKeyData = await deviceManager.registerDevice(
            accountId,
            passphrase,
            (msg) => onProgress?.(0.1, msg)
          );

          // Use the newly registered device key
          const deviceSalt = decodeBase64(registeredKeyData.salt);
          const result = await deriveKeyUnified(
            passphrase,
            deviceSalt,
            registeredKeyData.kdf_iterations,
            onProgress
          );

          return result;
        } catch (regError) {
          console.log(
            '[Crypto] Device registration failed, using account defaults:',
            regError
          );
          // Fall through to use account defaults
        }
      }
    }

    // Fallback: Use account-level iterations
    const iterations = keyData.kdf_iterations || keyData.iterations || 100000;
    console.log(`[Crypto] Using account iterations: ${iterations}`);

    const result = await deriveKeyUnified(
      passphrase,
      salt,
      iterations,
      onProgress
    );

    debugLog('deriveLightweightKey:done', {
      resultLength: result.length,
      expectedLength: 32,
      iterations,
    });

    return result;
  } catch (e: any) {
    debugLog('deriveLightweightKey:error', String(e?.message || e));
    throw e;
  }
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
  // Accept 12-byte (GCM) and 24-byte (XChaCha20) nonces
  if (iv.length !== 12 && iv.length !== 24)
    throw new Error(
      `Invalid key data: IV must be 12 or 24 bytes, got ${iv.length}`
    );
  if (wrapped.length === 0)
    throw new Error('Invalid key data: missing wrapped key');
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
    throw new Error(
      `Invalid source config: IV must be 12 or 24 bytes, got ${cfgIv.length}`
    );
  if (cfgEnc.length === 0)
    throw new Error('Invalid source config: missing encrypted payload');
  debugLog('validateSourceConfig:ok', {
    ivLen: cfgIv.length,
    encLen: cfgEnc.length,
  });
}

type MasterKeyInputs = {
  accountId: string;
  passphrase: string;
  keyData: SourceInfo['keyData'];
  salt: Uint8Array;
  iv: Uint8Array;
  wrapped: Uint8Array;
};

const storage: MMKV | null = (() => {
  try {
    return new MMKV();
  } catch {
    return null;
  }
})();

async function getOrDeriveMasterKey(args: {
  accountId: string;
  passphrase: string;
  keyData: any;
  salt: Uint8Array;
  iv: Uint8Array;
  wrapped: Uint8Array;
  onProgress?: (progress: number, message?: string) => void;
}): Promise<Uint8Array> {
  console.log('[getOrDeriveMasterKey] Starting for account:', args.accountId);
  const { accountId, passphrase, keyData, salt, iv, wrapped, onProgress } =
    args;
  const cacheKeyPersist = `mk:${accountId}`;
  debugLog('getOrDeriveMasterKey:start', { accountId });
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
  // Use PBKDF2 for lightweight key derivation
  console.log(
    '[getOrDeriveMasterKey] No cache hit, starting key derivation...'
  );

  const personalKeyBytes = await deriveLightweightKey(
    passphrase,
    salt,
    keyData,
    onProgress,
    accountId
  );
  console.log('[getOrDeriveMasterKey] Key derivation completed');

  // Choose correct IV/wrapped layer: prefer device-specific if available
  let ivToUse = iv;
  let wrappedToUse = wrapped;
  try {
    const deviceManager = DeviceManager.getInstance();
    const deviceKeyData = await deviceManager.getDeviceKeyData(accountId);
    if (deviceKeyData?.iv && deviceKeyData?.master_key_wrapped) {
      ivToUse = decodeBase64(String(deviceKeyData.iv));
      wrappedToUse = decodeBase64(String(deviceKeyData.master_key_wrapped));
    }
  } catch {}

  let masterKeyBytes: Uint8Array;
  try {
    masterKeyBytes = aesGcmDecrypt(personalKeyBytes, ivToUse, wrappedToUse);
  } catch (e: any) {
    debugLog('getOrDeriveMasterKey:aesGcm:error', String(e?.message || e));
    throw e;
  }
  console.log('[getOrDeriveMasterKey] Master key decryption completed');
  debugLog('getOrDeriveMasterKey:derived');
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

export function useSourceCredentials() {
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
