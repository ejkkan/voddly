'use client';

import { Platform } from 'react-native';
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
    master_key_wrapped: string; // Changed from wrapped_master_key to match backend
    salt: string;
    iv: string;
    iterations?: number;
    // Optional new fields for sodium-based scheme
    kdf?: 'pbkdf2' | 'argon2id';
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
    return resolveSourceInfo(targetId);
  }

  async getSourceCredentials(
    sourceId: string,
    options: SourceCredentialsOptions = {}
  ): Promise<SourceCredentials> {
    debugLog('getSourceCredentials:start', { sourceId });
    const info = await this.findSourceInfo(sourceId);
    debugLog('getSourceCredentials:resolvedSourceInfo', {
      accountId: info.account.id,
      accountName: info.account.name,
      source: { id: info.source.id, name: info.source.name },
      keyDataPresent: !!info.keyData,
    });
    try {
      const result = await this.attemptGetCredentials(info, options);
      debugLog('getSourceCredentials:successFirstAttempt');
      return result;
    } catch (err: any) {
      debugLog(
        'getSourceCredentials:firstAttemptFailed:clearingCaches',
        String(err?.message || err)
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
      debugLog('getSourceCredentials:successSecondAttempt');
      return result;
    }
  }
  // Helper to decrypt config JSON given an unwrapped master key
  async decryptSourceConfigWithKey(
    info: SourceInfo,
    masterKeyBytes: Uint8Array
  ): Promise<SourceCredentials> {
    debugLog('decryptSourceConfigWithKey:start', {
      cfgIvB64Len: String(info.source.config_iv || '').length,
      encCfgB64Len: String(info.source.encrypted_config || '').length,
    });
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
      debugLog('decryptSourceConfigWithKey:usingAlgo', {
        alg,
        ivLen: cfgIv.length,
      });
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
    debugLog('getSourceCredentials:promptingPassphrase');
    const passphrase = await this.getPassphrase(info.account.id, {
      title: options.title || 'Decrypt Source',
      message: options.message || 'Enter your passphrase to decrypt the source',
      accountName: info.account.name,
      validateFn: options.validatePassphrase,
    });
    debugLog('getSourceCredentials:gotPassphrase', {
      cached: passphraseCache.has(info.account.id),
      length: passphrase?.length ?? 0,
    });

    // Web-only: avoid client-side Argon2 due to atob failures in env; use backend to decrypt
    if (Platform.OS === 'web') {
      try {
        debugLog('getSourceCredentials:web:serverDecrypt:start', {
          sourceId: info.source.id,
        });
        const resp = await apiClient.user.decryptSource(info.source.id, {
          passphrase,
        });
        debugLog('getSourceCredentials:web:serverDecrypt:done', {
          hasCreds: !!resp?.credentials,
        });
        return resp.credentials as SourceCredentials;
      } catch (e: any) {
        debugLog(
          'getSourceCredentials:web:serverDecrypt:error',
          String(e?.message || e)
        );
        throw e;
      }
    }

    const { salt, iv, wrapped } = validateAndParseKeyData(info.keyData);
    debugLog('getSourceCredentials:keyDataParsed', {
      saltLen: salt.length,
      ivLen: iv.length,
      wrappedLen: wrapped.length,
    });
    const masterKeyBytes = await getOrDeriveMasterKey({
      accountId: info.account.id,
      passphrase,
      keyData: info.keyData,
      salt,
      iv,
      wrapped,
    });
    debugLog('getSourceCredentials:masterKeyDerived', {
      masterKeyLen: masterKeyBytes.length,
    });
    validateSourceConfig(info.source);
    const creds = await this.decryptSourceConfigWithKey(info, masterKeyBytes);
    debugLog('getSourceCredentials:configDecrypted', {
      serverPresent: !!creds.server,
      usernamePresent: !!creds.username,
    });
    return creds;
  }
}

// Helpers split out for readability and testability
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
        debugLog('resolveSourceInfo:defaultingSingleSource', {
          sourceId: only.id,
        });
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
      debugLog('resolveSourceInfo:errorFetchingAccount', {
        accountId: account.id,
      });
      continue;
    }
  }
  debugLog('resolveSourceInfo:notFound');
  throw new Error('Source not found in any account');
}

async function deriveArgon2Key(
  passphrase: string,
  salt: Uint8Array,
  _keyData: { iterations?: number }
): Promise<Uint8Array> {
  if (salt.length !== 16) throw new Error('invalid salt length');

  // Use Argon2id to match backend
  if (Platform.OS === 'web') {
    // Use argon2-browser for web
    const argon2 = await import('argon2-browser');
    debugLog('deriveArgon2Key:web:start', { saltLen: salt.length });
    let result: any;
    try {
      // Temporarily bypass atob shim while argon2-browser runs to avoid interference
      const g = globalThis as any;
      const prevBypass = g.__BYPASS_ATOB_SHIM;
      g.__BYPASS_ATOB_SHIM = true;
      result = await argon2.hash({
        pass: passphrase,
        salt: salt,
        type: argon2.ArgonType.Argon2id,
        hashLen: 32,
        time: 3, // iterations/time cost
        mem: 65536, // 64MB memory cost
        parallelism: 1,
      });
      g.__BYPASS_ATOB_SHIM = prevBypass;
    } catch (e: any) {
      debugLog('deriveArgon2Key:web:error', String(e?.message || e));
      throw e;
    }
    debugLog('deriveArgon2Key:web:done');
    return new Uint8Array(result.hash);
  } else {
    // Use react-native-argon2 for native
    const Argon2 = await import('react-native-argon2').then((m) => m.default);
    debugLog('deriveArgon2Key:native:start', { saltLen: salt.length });
    const result = await Argon2.argon2(passphrase, encodeBase64(salt), {
      iterations: 3,
      memory: 65536,
      parallelism: 1,
      hashLength: 32,
      mode: 'argon2id',
    });
    debugLog('deriveArgon2Key:native:done');
    return decodeBase64(result.rawHash);
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

const storage: MMKV | null = Platform.OS === 'web' ? null : new MMKV();

async function getOrDeriveMasterKey(
  args: MasterKeyInputs
): Promise<Uint8Array> {
  const { accountId, passphrase, keyData, salt, iv, wrapped } = args;
  const cacheKeyPersist = `mk:${accountId}`;
  debugLog('getOrDeriveMasterKey:start', { accountId });
  try {
    const packed = storage?.getString(cacheKeyPersist);
    if (packed) {
      const obj = JSON.parse(packed) as { b64: string; exp: number };
      if (Date.now() < obj.exp) {
        const keyBytes = decodeBase64(obj.b64);
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
    debugLog('getOrDeriveMasterKey:hitMemoryCache');
    return cached.key;
  }
  // Use Argon2id to match the backend
  const personalKeyBytes = await deriveArgon2Key(passphrase, salt, keyData);
  let masterKeyBytes: Uint8Array;
  try {
    masterKeyBytes = aesGcmDecrypt(personalKeyBytes, iv, wrapped);
  } catch (e: any) {
    debugLog('getOrDeriveMasterKey:aesGcm:error', String(e?.message || e));
    throw e;
  }
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
