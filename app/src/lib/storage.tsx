import { MMKV } from 'react-native-mmkv';

let storage: MMKV;
let fallbackToLocalStorage = false;

// Try to initialize MMKV, fall back to localStorage if it fails
try {
  storage = new MMKV();
  // Test if MMKV is working by trying to set/get a test value
  storage.set('__test__', 'test');
  storage.delete('__test__');
} catch (error) {
  console.warn('[Storage] MMKV failed to initialize, falling back to localStorage:', error);
  fallbackToLocalStorage = true;
}

export { storage };

export function getItem<T>(key: string): T | null {
  try {
    let value: string | null = null;
    
    if (fallbackToLocalStorage && typeof window !== 'undefined') {
      value = localStorage.getItem(key);
    } else {
      value = storage.getString(key);
    }
    
    return value ? JSON.parse(value) || null : null;
  } catch (error) {
    console.warn('[Storage] getItem failed:', error);
    return null;
  }
}

export async function setItem<T>(key: string, value: T) {
  try {
    const stringValue = JSON.stringify(value);
    
    if (fallbackToLocalStorage && typeof window !== 'undefined') {
      localStorage.setItem(key, stringValue);
    } else {
      storage.set(key, stringValue);
    }
  } catch (error) {
    console.warn('[Storage] setItem failed:', error);
  }
}

export async function removeItem(key: string) {
  try {
    if (fallbackToLocalStorage && typeof window !== 'undefined') {
      localStorage.removeItem(key);
    } else {
      storage.delete(key);
    }
  } catch (error) {
    console.warn('[Storage] removeItem failed:', error);
  }
}
