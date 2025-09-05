'use client';

import { Platform } from 'react-native';

import { getItem, setItem } from '@/lib/storage';

type CachedPassphrase = {
  passphrase: string;
  timestamp: number;
  expiresAt: number;
};

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day
const STORAGE_KEY = 'passphrase_cache';

function isWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

function loadFromStorage(): Record<string, CachedPassphrase> {
  try {
    if (isWeb()) {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, CachedPassphrase>) : {};
    }
    return getItem<Record<string, CachedPassphrase>>(STORAGE_KEY) || {};
  } catch {
    return {};
  }
}

function saveToStorage(entries: Record<string, CachedPassphrase>) {
  try {
    if (isWeb()) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      return;
    }
    void setItem(STORAGE_KEY, entries);
  } catch {}
}

export class PassphraseCache {
  private cache = new Map<string, CachedPassphrase>();

  constructor() {
    const loaded = loadFromStorage();
    const now = Date.now();
    for (const [k, v] of Object.entries(loaded)) {
      if (now <= v.expiresAt) this.cache.set(k, v);
    }
    this.persist();
  }

  set(accountId: string, passphrase: string) {
    const now = Date.now();
    this.cache.set(accountId, {
      passphrase,
      timestamp: now,
      expiresAt: now + CACHE_DURATION_MS,
    });
    this.persist();
  }

  get(accountId: string): string | null {
    const entry = this.cache.get(accountId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(accountId);
      this.persist();
      return null;
    }
    return entry.passphrase;
  }

  has(accountId: string): boolean {
    return this.get(accountId) !== null;
  }

  remove(accountId: string) {
    this.cache.delete(accountId);
    this.persist();
  }

  clear() {
    this.cache.clear();
    this.persist();
  }

  getTimeRemaining(accountId: string): number {
    const entry = this.cache.get(accountId);
    if (!entry) return 0;
    return Math.max(0, entry.expiresAt - Date.now());
  }

  getCachedAccountIds(): string[] {
    this.cleanup();
    return Array.from(this.cache.keys());
  }

  cleanup() {
    const now = Date.now();
    let changed = false;
    for (const [k, v] of this.cache.entries()) {
      if (now > v.expiresAt) {
        this.cache.delete(k);
        changed = true;
      }
    }
    if (changed) this.persist();
  }

  private persist() {
    const obj: Record<string, CachedPassphrase> = {};
    const now = Date.now();
    for (const [k, v] of this.cache.entries()) {
      if (now <= v.expiresAt) obj[k] = v;
    }
    saveToStorage(obj);
  }
}

export const passphraseCache = new PassphraseCache();

if (isWeb()) {
  setInterval(() => passphraseCache.cleanup(), 60 * 1000);
}
