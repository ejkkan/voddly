'use client';

import { Platform } from 'react-native';

/**
 * Unified crypto implementation that uses the best available method per platform.
 * - iOS/Android: react-native-quick-crypto (native, 10-50x faster)
 * - tvOS/Web: @noble/hashes (JavaScript)
 */

// Try to load react-native-quick-crypto if available
let quickCrypto: any = null;
try {
  // Only attempt to load on iOS/Android
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    quickCrypto = require('react-native-quick-crypto');
    console.log('[Crypto] react-native-quick-crypto loaded successfully');
  }
} catch (error) {
  console.log(
    '[Crypto] react-native-quick-crypto not available, using JavaScript fallback'
  );
}

/**
 * Get optimal iteration count based on platform and crypto availability
 */
export function getOptimalIterations(): number {
  if (Platform.OS === 'web') {
    return 500000; // Web can handle it
  } else if (Platform.OS === 'ios' && quickCrypto) {
    return 500000; // iOS with native crypto is fast
  } else if (Platform.OS === 'android' && quickCrypto) {
    return 400000; // Android with native crypto
  } else if (Platform.OS === 'tvos') {
    return 100000; // tvOS only has JavaScript
  } else {
    // Fallback for unknown platforms or missing native crypto
    return 200000;
  }
}

/**
 * Get device type string for API
 */
export function getDeviceType(): 'ios' | 'tvos' | 'android' | 'web' {
  switch (Platform.OS) {
    case 'ios':
      // Check if it's actually tvOS
      // @ts-ignore
      if (Platform.isTVOS || Platform.isTV) {
        return 'tvos';
      }
      return 'ios';
    case 'android':
      return 'android';
    case 'web':
      return 'web';
    default:
      return 'web';
  }
}

// Import at the top of the file if available
let Constants: any;
let Application: any;
try {
  Constants = require('expo-constants').default;
} catch {}
try {
  Application = require('expo-application');
} catch {}

/**
 * Generate a unique device ID that persists across app launches
 */
export async function getDeviceId(): Promise<string> {
  if (Platform.OS === 'web') {
    // For web, use localStorage
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  } else {
    // For native platforms, try multiple methods to get a stable ID

    // First try expo-constants for installation ID
    if (Constants?.installationId) {
      return Constants.installationId;
    }

    // If no installation ID, try device ID (more stable)
    if (Constants?.deviceId) {
      return Constants.deviceId;
    }

    // Try expo-application for a stable ID
    if (Application) {
      if (Application.androidId) {
        return `android-${Application.androidId}`;
      }
      if (Platform.OS === 'ios' && Application.getIosIdForVendorAsync) {
        try {
          const vendorId = await Application.getIosIdForVendorAsync();
          if (vendorId) {
            return `ios-${vendorId}`;
          }
        } catch {}
      }
    }

    // Last resort: use MMKV storage to persist an ID
    const MMKV = require('react-native-mmkv').MMKV;
    const storage = new MMKV();
    let deviceId = storage.getString('persistent_device_id');
    if (!deviceId) {
      deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      storage.set('persistent_device_id', deviceId);
    }
    return deviceId;
  }
}

/**
 * Derive a key using the best available method
 */
export async function deriveKeyUnified(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  onProgress?: (progress: number, message?: string) => void
): Promise<Uint8Array> {
  console.log(`[Crypto] Starting key derivation with ${iterations} iterations`);
  const startTime = Date.now();

  // Report start
  onProgress?.(
    0.05,
    `Starting key derivation (${iterations.toLocaleString()} iterations)`
  );

  // Use native crypto if available (iOS/Android only)
  if (quickCrypto && (Platform.OS === 'ios' || Platform.OS === 'android')) {
    try {
      console.log('[Crypto] Using native quick-crypto implementation');

      // Progress updates for native (it's so fast we just show quick progress)
      let progressValue = 0.1;
      const progressInterval = setInterval(() => {
        progressValue = Math.min(progressValue + 0.2, 0.9);
        onProgress?.(progressValue, 'Processing with native crypto...');
      }, 100);

      // Use react-native-quick-crypto's pbkdf2
      const keyBuffer = await new Promise<Buffer>((resolve, reject) => {
        quickCrypto.pbkdf2(
          passphrase,
          salt,
          iterations,
          32, // key length
          'sha256',
          (err: any, derivedKey: Buffer) => {
            if (err) reject(err);
            else resolve(derivedKey);
          }
        );
      });

      clearInterval(progressInterval);

      const result = new Uint8Array(keyBuffer);
      const elapsed = Date.now() - startTime;

      console.log(`[Crypto] Native derivation completed in ${elapsed}ms`);
      onProgress?.(1, `Completed in ${(elapsed / 1000).toFixed(1)}s`);

      return result;
    } catch (error) {
      console.error(
        '[Crypto] Native crypto failed, falling back to JavaScript:',
        error
      );
      // Fall through to JavaScript implementation
    }
  }

  // Fallback to JavaScript implementation (tvOS, Web, or if native fails)
  console.log('[Crypto] Using JavaScript implementation');
  const { pbkdf2 } = await import('@noble/hashes/pbkdf2');
  const { sha256 } = await import('@noble/hashes/sha256');

  // For JavaScript, show progress updates
  if (Platform.OS === 'tvos' || Platform.OS === 'web') {
    // Simple progress animation since we can't get real progress from pbkdf2
    let progressValue = 0.1;
    const estimatedMs = iterations / 100; // Rough estimate
    const updateInterval = Math.min(100, estimatedMs / 20);

    const progressInterval = setInterval(() => {
      progressValue = Math.min(progressValue + 0.05, 0.95);
      const elapsed = (Date.now() - startTime) / 1000;
      onProgress?.(
        progressValue,
        `Deriving key... ${Math.round(progressValue * 100)}% (${elapsed.toFixed(1)}s)`
      );
    }, updateInterval);

    const result = pbkdf2(sha256, passphrase, salt, {
      c: iterations,
      dkLen: 32,
    });

    clearInterval(progressInterval);

    const elapsed = Date.now() - startTime;
    console.log(`[Crypto] JavaScript derivation completed in ${elapsed}ms`);
    onProgress?.(1, `Completed in ${(elapsed / 1000).toFixed(1)}s`);

    return result;
  } else {
    // For other platforms, just run it
    const result = pbkdf2(sha256, passphrase, salt, {
      c: iterations,
      dkLen: 32,
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Crypto] Derivation completed in ${elapsed}ms`);
    onProgress?.(1, 'Key derivation complete');

    return result;
  }
}

/**
 * Benchmark the crypto implementation
 */
export async function benchmarkCrypto() {
  const testPassphrase = 'benchmark_test_123';
  const testSalt = new Uint8Array(16).fill(42);

  console.log('=== Crypto Benchmark ===');
  console.log(`Platform: ${Platform.OS}`);
  console.log(`Native crypto available: ${!!quickCrypto}`);

  // Test with different iteration counts
  const testCases = [10000, 50000, 100000];

  for (const iterations of testCases) {
    const start = Date.now();
    await deriveKeyUnified(testPassphrase, testSalt, iterations);
    const elapsed = Date.now() - start;
    console.log(
      `${iterations} iterations: ${elapsed}ms (${(iterations / elapsed).toFixed(0)} iter/ms)`
    );
  }

  const optimal = getOptimalIterations();
  console.log(`Optimal iterations for this platform: ${optimal}`);
}
