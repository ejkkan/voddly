'use client';

import { apiClient } from '@/lib/api-client';
import { passphraseCache } from '@/lib/passphrase-cache';

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
    const accounts = await apiClient.user.getAccounts();
    for (const account of accounts.accounts || []) {
      try {
        const { sources, keyData } = await apiClient.user.getSources(
          account.id
        );
        const source = (sources || []).find((s) => s.id === String(sourceId));
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
    throw new Error('Source not found in any account');
  }

  async getSourceCredentials(
    sourceId: string,
    options: SourceCredentialsOptions = {}
  ): Promise<SourceCredentials> {
    const info = await this.findSourceInfo(sourceId);
    const passphrase = await this.getPassphrase(info.account.id, {
      title: options.title || 'Decrypt Source',
      message: options.message || 'Enter your passphrase to decrypt the source',
      accountName: info.account.name,
      validateFn: options.validatePassphrase,
    });

    // Derive and unwrap using WebCrypto (same approach used in playlists.tsx)
    const b64ToBytes = (b64: string) => {
      try {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
      } catch {
        const fixed = b64.replace(/-/g, '+').replace(/_/g, '/');
        const pad =
          fixed.length % 4 === 0 ? '' : '='.repeat(4 - (fixed.length % 4));
        const bin = atob(fixed + pad);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
      }
    };

    const salt = b64ToBytes(info.keyData.salt);
    const iv = b64ToBytes(info.keyData.iv);
    const wrapped = b64ToBytes(info.keyData.wrapped_master_key);
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    const personalKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: info.keyData.iterations || 500000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    const masterKeyBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      personalKey,
      wrapped
    );
    const masterKey = await crypto.subtle.importKey(
      'raw',
      masterKeyBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const cfgIv = b64ToBytes(info.source.config_iv);
    const cfgEnc = b64ToBytes(info.source.encrypted_config);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: cfgIv },
      masterKey,
      cfgEnc
    );
    const credentials = JSON.parse(
      new TextDecoder().decode(new Uint8Array(decrypted))
    );
    return credentials as SourceCredentials;
  }
}

export function useSourceCredentials() {
  return {
    getCredentials: async (
      sourceId: string,
      options?: SourceCredentialsOptions
    ): Promise<SourceCredentials> => {
      const manager = new SourceCredentialsManager({
        getPassphrase: async (accountId, opts) => {
          // Use in-memory cache first; otherwise prompt minimally (native UI TBD)
          let cached = passphraseCache.get(accountId);
          if (cached) return cached;
          const input =
            typeof window !== 'undefined'
              ? window.prompt(opts?.message || 'Enter passphrase')
              : '';
          if (!input || input.length < 6)
            throw new Error('Passphrase required');
          passphraseCache.set(accountId, input);
          return input;
        },
      });
      return manager.getSourceCredentials(sourceId, options);
    },
    prepareContentPlayback: async (
      sourceId: string,
      contentId: string | number,
      contentType: 'movie' | 'series' | 'live',
      options?: SourceCredentialsOptions
    ) => {
      const creds = await new SourceCredentialsManager({
        getPassphrase: async (accountId, opts) => {
          let cached = passphraseCache.get(accountId);
          if (cached) return cached;
          const input =
            typeof window !== 'undefined'
              ? window.prompt(opts?.message || 'Enter passphrase')
              : '';
          if (!input || input.length < 6)
            throw new Error('Passphrase required');
          passphraseCache.set(accountId, input);
          return input;
        },
      }).getSourceCredentials(sourceId, options);
      return { credentials: creds, sourceId, contentId, contentType };
    },
  };
}
