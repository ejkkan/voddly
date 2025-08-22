'use client';

import { Env } from '@env';
import { Platform } from 'react-native';

import { getItem, removeItem, setItem } from '@/lib/storage';

const AUTH_COOKIE_KEY = 'auth.session.cookie';

function normalizeDevHost(url: string): string {
  if (!url) return url;
  if (__DEV__ && Platform.OS === 'android') {
    url = url.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
  }
  return url;
}

function getBaseURL() {
  const raw = (Env.API_URL as string) || 'http://localhost:4000';
  const api = normalizeDevHost(raw).replace(/\/+$/, '');
  return `${api}/api/auth`;
}

function getApiRoot() {
  const raw = (Env.API_URL as string) || 'http://localhost:4000';
  return normalizeDevHost(raw).replace(/\/+$/, '');
}

function getStoredCookie(): string | null {
  return getItem<string>(AUTH_COOKIE_KEY);
}

async function setStoredCookie(cookie: string) {
  await setItem(AUTH_COOKIE_KEY, cookie);
}

async function clearStoredCookie() {
  await removeItem(AUTH_COOKIE_KEY);
}

function extractSetCookie(headers: Headers): string | null {
  // Some environments expose 'set-cookie' or 'Set-Cookie'
  const cookie = headers.get('set-cookie') || headers.get('Set-Cookie');
  return cookie;
}

async function doFetch(path: string, init?: RequestInit) {
  const base = getBaseURL().replace(/\/+$/, '');
  const rel = path.startsWith('/') ? path : `/${path}`;
  const method = (init?.method || 'GET').toUpperCase();
  try {
    // helpful dev log
    // Debug log removed
  } catch {}

  // Only set JSON content-type for non-GET/HEAD requests
  const includeJsonHeader = method !== 'GET' && method !== 'HEAD';
  const stored = getStoredCookie();
  const headers: Record<string, string> = {
    ...(includeJsonHeader ? { 'Content-Type': 'application/json' } : {}),
    ...(stored ? { cookie: stored } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };

  // Never send a body with GET/HEAD
  const safeInit: RequestInit = {
    ...init,
    method,
    credentials: 'include',
    headers,
    ...(method === 'GET' || method === 'HEAD' ? { body: undefined } : {}),
  };
  console.log('safeInit', `${base}${rel}`, safeInit);
  const res = await fetch(`${base}${rel}`, safeInit);

  const setCookie = extractSetCookie(res.headers);
  if (setCookie) {
    await setStoredCookie(setCookie);
  }

  if (!res.ok) {
    let message = `Auth request failed: ${res.status}`;
    try {
      const text = await res.text();
      message += `: ${text}`;
    } catch {}
    throw new Error(message);
  }

  return res;
}

export const authClient = {
  async getSession() {
    try {
      const res = await doFetch('/session', { method: 'GET' });
      try {
        return await res.json();
      } catch {
        return null;
      }
    } catch (_e: any) {
      // Fallback to backend user endpoint if /session is not available
      const res = await fetch(`${getApiRoot()}/user/me`, {
        method: 'GET',
        credentials: 'include',
        headers: getStoredCookie()
          ? { cookie: getStoredCookie() as string }
          : undefined,
      });
      if (!res.ok) return null;
      const user = await res.json();
      return { data: { user } } as any;
    }
  },

  signIn: {
    async email(params: { email: string; password: string }) {
      const res = await doFetch('/sign-in/email', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return await res.json();
    },
  },

  signUp: {
    async email(params: { email: string; password: string; name?: string }) {
      const res = await doFetch('/sign-up/email', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return await res.json();
    },
  },

  async signOut() {
    try {
      await doFetch('/sign-out', { method: 'POST' });
    } finally {
      await clearStoredCookie();
    }
    return { ok: true } as const;
  },

  // Expose cookie helpers for API client
  getCookie(): string | null {
    return getStoredCookie();
  },
};

export default authClient;
