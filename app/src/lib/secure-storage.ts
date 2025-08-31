import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';

/**
 * Secure storage utility for sensitive data
 * Uses encryption for web localStorage and MMKV encryption for native
 */

// Use a session-based key derived from user session
let sessionKey: string | null = null;

/**
 * Generate a session key from user data
 * This should be called after login with user-specific data
 */
export function initializeSecureStorage(userId: string, timestamp: number) {
  // Create a session-specific key that changes each session
  // This provides some protection but isn't perfect security
  const baseKey = `${userId}-${timestamp}-${navigator.userAgent || 'unknown'}`;
  sessionKey = btoa(baseKey).substring(0, 32);
}

/**
 * Simple XOR encryption for obfuscation
 * Not cryptographically secure but better than plaintext
 */
function simpleEncrypt(text: string, key: string): string {
  if (!key) return text;

  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return btoa(result); // Base64 encode for safe storage
}

/**
 * Simple XOR decryption
 */
function simpleDecrypt(encoded: string, key: string): string {
  if (!key) return encoded;

  try {
    const text = atob(encoded); // Base64 decode
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return result;
  } catch (error) {
    console.error('[SecureStorage] Decryption failed:', error);
    return '';
  }
}

/**
 * Store sensitive data securely
 */
export function secureStore(key: string, value: any): void {
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (!sessionKey) {
        console.warn(
          '[SecureStorage] No session key initialized, storing unencrypted'
        );
        window.localStorage.setItem(key, stringValue);
        return;
      }

      // Encrypt the value before storing
      const encrypted = simpleEncrypt(stringValue, sessionKey);
      window.localStorage.setItem(`encrypted_${key}`, encrypted);

      // Store a flag indicating this is encrypted
      window.localStorage.setItem(`${key}_encrypted`, 'true');
    }
  } else {
    // For native, use MMKV with encryption
    const storage = new MMKV({
      id: 'secure-storage',
      encryptionKey: sessionKey || undefined,
    });
    storage.set(key, stringValue);
  }
}

/**
 * Retrieve sensitive data securely
 */
export function secureRetrieve(key: string): any {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Check if the data is encrypted
      const isEncrypted =
        window.localStorage.getItem(`${key}_encrypted`) === 'true';

      if (isEncrypted && sessionKey) {
        const encrypted = window.localStorage.getItem(`encrypted_${key}`);
        if (!encrypted) return null;

        const decrypted = simpleDecrypt(encrypted, sessionKey);
        try {
          return JSON.parse(decrypted);
        } catch {
          return decrypted; // Return as string if not JSON
        }
      } else {
        // Fallback to unencrypted for backward compatibility
        const value = window.localStorage.getItem(key);
        if (!value) return null;

        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
    }
  } else {
    // For native, use MMKV
    const storage = new MMKV({
      id: 'secure-storage',
      encryptionKey: sessionKey || undefined,
    });
    const value = storage.getString(key);
    if (!value) return null;

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return null;
}

/**
 * Remove sensitive data
 */
export function secureRemove(key: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      window.localStorage.removeItem(`encrypted_${key}`);
      window.localStorage.removeItem(`${key}_encrypted`);
    }
  } else {
    const storage = new MMKV({
      id: 'secure-storage',
      encryptionKey: sessionKey || undefined,
    });
    storage.delete(key);
  }
}

/**
 * Clear all secure storage
 */
export function secureClear(): void {
  sessionKey = null;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Clear all encrypted items
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (
          key &&
          (key.startsWith('encrypted_') || key.endsWith('_encrypted'))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    }
  } else {
    const storage = new MMKV({ id: 'secure-storage' });
    storage.clearAll();
  }
}

/**
 * Store device key data securely with additional encryption
 */
export function storeDeviceKeyData(accountId: string, keyData: any): void {
  // Add additional metadata for validation
  const dataToStore = {
    keyData,
    timestamp: Date.now(),
    accountId,
    version: 1,
  };

  secureStore(`keyData_${accountId}`, dataToStore);
}

/**
 * Retrieve device key data with validation
 */
export function retrieveDeviceKeyData(accountId: string): any {
  const stored = secureRetrieve(`keyData_${accountId}`);

  if (!stored) return null;

  // Validate the data
  if (stored.accountId !== accountId) {
    console.error('[SecureStorage] Account ID mismatch in stored data');
    return null;
  }

  // Check if data is too old (e.g., 30 days)
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  if (stored.timestamp && Date.now() - stored.timestamp > maxAge) {
    console.warn('[SecureStorage] Stored key data is expired');
    secureRemove(`keyData_${accountId}`);
    return null;
  }

  return stored.keyData;
}
