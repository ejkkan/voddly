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
    wrapped_master_key: string;
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
    const info = await this.findSourceInfo(sourceId);
    const attempt = async (
      _forcePrompt: boolean
    ): Promise<SourceCredentials> => {
      const passphrase = await this.getPassphrase(info.account.id, {
        title: options.title || 'Decrypt Source',
        message:
          options.message || 'Enter your passphrase to decrypt the source',
        accountName: info.account.name,
        validateFn: options.validatePassphrase,
      });
      const { salt, iv, wrapped } = validateAndParseKeyData(info.keyData);
      const masterKeyBytes = await getOrDeriveMasterKey({
        accountId: info.account.id,
        passphrase,
        keyData: info.keyData,
        salt,
        iv,
        wrapped,
      });
      validateSourceConfig(info.source);
      return this.decryptSourceConfigWithKey(info, masterKeyBytes);
    };
    try {
      return await attempt(false);
    } catch (_e: any) {
      // On crypto errors, clear caches and force re-prompt
      try {
        passphraseCache.remove(info.account.id);
      } catch {}
      try {
        const g = globalThis as any;
        if (g.__masterKeyCache)
          g.__masterKeyCache.delete(`acct:${info.account.id}`);
      } catch {}
      return attempt(true);
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
      throw new Error(
        'Failed to decrypt source config: ' + String(err?.message || err)
      );
    }
  }
}

// Helpers split out for readability and testability
async function resolveSourceInfo(targetId: string): Promise<SourceInfo> {
  const accounts = await apiClient.user.getAccounts();
  for (const account of accounts.accounts || []) {
    try {
      const { sources, keyData } = await apiClient.user.getSources(account.id);
      const list = sources || [];
      const source = list.find((s) => s.id === targetId || s.name === targetId);
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
      if (!source && keyData && list.length === 1) {
        const only = list[0];
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
      continue;
    }
  }
  throw new Error('Source not found in any account');
}

async function derivePBKDF2Key(
  passphrase: string,
  salt: Uint8Array,
  keyData: { iterations?: number }
): Promise<Uint8Array> {
  if (salt.length !== 16) throw new Error('invalid salt length');
  const iterations = keyData.iterations ?? 150_000;
  const pwd = new TextEncoder().encode(passphrase);
  // Using runtime import to avoid circular issues in tooling; main import at top is preferred
  const { pbkdf2 } = await import('@noble/hashes/pbkdf2');
  const { sha256 } = await import('@noble/hashes/sha256');
  const derived = pbkdf2(sha256, pwd, salt, { c: iterations, dkLen: 32 });
  return new Uint8Array(derived);
}

function validateAndParseKeyData(keyData: SourceInfo['keyData']): {
  salt: Uint8Array;
  iv: Uint8Array;
  wrapped: Uint8Array;
} {
  const salt = decodeBase64(String(keyData.salt || ''));
  const iv = decodeBase64(String(keyData.iv || ''));
  const wrapped = decodeBase64(String(keyData.wrapped_master_key || ''));
  if (salt.length === 0) throw new Error('Invalid key data: missing salt');
  if (iv.length === 0) throw new Error('Invalid key data: missing IV');
  // Accept 12-byte (GCM) and 24-byte (XChaCha20) nonces
  if (iv.length !== 12 && iv.length !== 24)
    throw new Error(
      `Invalid key data: IV must be 12 or 24 bytes, got ${iv.length}`
    );
  if (wrapped.length === 0)
    throw new Error('Invalid key data: missing wrapped key');
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
  try {
    const packed = storage?.getString(cacheKeyPersist);
    if (packed) {
      const obj = JSON.parse(packed) as { b64: string; exp: number };
      if (Date.now() < obj.exp) {
        const keyBytes = decodeBase64(obj.b64);
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
    return cached.key;
  }
  if (keyData.kdf && keyData.kdf !== 'pbkdf2') {
    throw new Error(
      'Unsupported key derivation scheme. Please migrate to PBKDF2.'
    );
  }
  const personalKeyBytes = await derivePBKDF2Key(passphrase, salt, keyData);
  const masterKeyBytes = aesGcmDecrypt(personalKeyBytes, iv, wrapped);
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
