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

export function getApiRoot() {
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
  // Get all Set-Cookie headers - there might be multiple
  const cookies: string[] = [];
  
  // Try to get all set-cookie headers (case-insensitive)
  headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      cookies.push(value);
    }
  });
  
  // If no Set-Cookie headers found, try the old way as fallback
  if (cookies.length === 0) {
    const cookie = headers.get('set-cookie') || headers.get('Set-Cookie');
    if (cookie) cookies.push(cookie);
  }
  
  // Join multiple cookies with semicolon and space
  return cookies.length > 0 ? cookies.join('; ') : null;
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
  console.log('[Auth Client] Set-Cookie headers received:', setCookie);
  if (setCookie) {
    console.log('[Auth Client] Storing cookie:', setCookie);
    await setStoredCookie(setCookie);
    console.log('[Auth Client] Cookie stored successfully');
  } else {
    console.log('[Auth Client] No Set-Cookie headers found');
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
    const cookie = getStoredCookie();
    console.log('[Auth Client] Retrieved cookie:', cookie);
    return cookie;
  },
};

export default authClient;
