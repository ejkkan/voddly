import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * Generate a stable device fingerprint that survives localStorage clear
 * Uses device characteristics that don't change
 */

interface FingerprintComponents {
  platform: string;
  userAgent?: string;
  vendor?: string;
  language?: string;
  screenResolution?: string;
  timezone?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  modelId?: string;
  brand?: string;
  osVersion?: string;
}

/**
 * Simple hash function for creating consistent IDs
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get stable browser fingerprint components
 */
function getBrowserFingerprint(): FingerprintComponents {
  const components: FingerprintComponents = {
    platform: 'web',
  };

  if (typeof window !== 'undefined') {
    const nav = window.navigator;

    // Stable browser characteristics
    components.userAgent = nav.userAgent;
    components.vendor = nav.vendor;
    components.language = nav.language;
    components.hardwareConcurrency = nav.hardwareConcurrency;

    // Screen characteristics (stable per device)
    if (window.screen) {
      components.screenResolution = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    }

    // Timezone (usually stable)
    try {
      components.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {}

    // Device memory (if available)
    if ('deviceMemory' in nav) {
      components.deviceMemory = (nav as any).deviceMemory;
    }
  }

  return components;
}

/**
 * Get stable native device fingerprint components
 */
function getNativeFingerprint(): FingerprintComponents {
  const components: FingerprintComponents = {
    platform: Platform.OS,
    modelId: Device.modelId || undefined,
    brand: Device.brand || undefined,
    osVersion: Device.osVersion || undefined,
  };

  // Add more stable characteristics
  if (Device.modelName) {
    components.userAgent = Device.modelName;
  }

  return components;
}

/**
 * Generate a stable device ID that persists across storage clears
 * This ID will be the same as long as the device characteristics don't change
 */
export function getStableDeviceId(): string {
  const components =
    Platform.OS === 'web' ? getBrowserFingerprint() : getNativeFingerprint();

  // Create a deterministic string from components
  // Order matters for consistency!
  const fingerprintString = [
    components.platform,
    components.userAgent || '',
    components.vendor || '',
    components.language || '',
    components.screenResolution || '',
    components.timezone || '',
    components.hardwareConcurrency?.toString() || '',
    components.deviceMemory?.toString() || '',
    components.modelId || '',
    components.brand || '',
    components.osVersion || '',
  ].join('|');

  // Generate a consistent hash
  const hash = simpleHash(fingerprintString);

  // Create a readable device ID
  const prefix = components.platform === 'web' ? 'web' : Platform.OS;
  return `${prefix}_${hash}_device`;
}

/**
 * Get a human-readable device name
 */
export function getDeviceName(): string {
  if (Platform.OS === 'web') {
    // Try to identify browser
    const ua = window.navigator.userAgent;
    let browser = 'Unknown Browser';

    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome'))
      browser = 'Safari';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';

    // Try to identify OS
    let os = 'Unknown OS';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad'))
      os = 'iOS';

    return `${browser} on ${os}`;
  }

  return Device.deviceName || `${Platform.OS} Device`;
}

/**
 * Get device model/details for logging
 */
export function getDeviceModel(): string | undefined {
  if (Platform.OS === 'web') {
    const ua = window.navigator.userAgent;
    // Truncate user agent for storage
    return ua.substring(0, 200);
  }

  return Device.modelName || undefined;
}

/**
 * Check if this is likely the same device (for deduplication)
 * Can be used server-side to detect duplicate registrations
 */
export function getDeviceCharacteristics() {
  const components =
    Platform.OS === 'web' ? getBrowserFingerprint() : getNativeFingerprint();

  return {
    platform: components.platform,
    screenResolution: components.screenResolution,
    timezone: components.timezone,
    language: components.language,
    modelId: components.modelId,
    brand: components.brand,
    // Don't include user agent as it changes frequently
  };
}
