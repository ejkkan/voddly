import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';

import {
  getDeviceModel,
  getDeviceName,
  getStableDeviceId,
} from './device-fingerprint';

const storage = new MMKV();

/**
 * Get or generate a unique device ID that works across all platforms
 * Uses stable fingerprinting to avoid duplicates when storage is cleared
 */
export function getDeviceId(): string {
  // Generate a stable device ID based on device characteristics
  // This will be the same even if localStorage/MMKV is cleared
  const stableId = getStableDeviceId();

  // For web, we can optionally cache it for performance
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.localStorage
  ) {
    // Store it for quick access, but it's not critical
    window.localStorage.setItem('deviceId', stableId);
  } else if (Platform.OS !== 'web') {
    // For native, cache in MMKV for performance
    storage.set('deviceId', stableId);
  }

  return stableId;
}

/**
 * Async version for compatibility
 */
export async function getDeviceIdAsync(): Promise<string> {
  return getDeviceId();
}

/**
 * Get device information including type, name, and model
 * Uses stable fingerprinting for consistent device identification
 */
export function getDeviceInfo() {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();
  const deviceModel = getDeviceModel();

  const deviceType =
    Platform.OS === 'ios'
      ? 'ios'
      : Platform.OS === 'android'
        ? 'android'
        : 'web';

  return {
    deviceId,
    deviceType: deviceType as 'ios' | 'android' | 'web',
    deviceName,
    deviceModel,
  };
}

/**
 * Async version for compatibility
 */
export async function getDeviceInfoAsync() {
  return getDeviceInfo();
}

/**
 * Clear the stored device ID (useful for testing or logout)
 */
export function clearDeviceId() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('deviceId');
    }
  } else {
    storage.delete('deviceId');
  }
}
