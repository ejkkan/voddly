'use client';

import * as ExpoCrypto from 'expo-crypto';
import { Platform } from 'react-native';

/**
 * Uses native crypto implementations for MUCH faster PBKDF2.
 * iOS/tvOS: CommonCrypto (C implementation, hardware accelerated)
 * Web: Falls back to @noble/hashes
 */
export async function deriveKeyNative(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  onProgress?: (progress: number, message?: string) => void
): Promise<Uint8Array> {
  console.log(
    `[Crypto] Starting native key derivation with ${iterations} iterations`
  );
  const startTime = Date.now();

  // Report start
  onProgress?.(
    0.1,
    `Starting key derivation (${iterations.toLocaleString()} iterations)`
  );

  try {
    if (
      Platform.OS === 'ios' ||
      Platform.OS === 'android' ||
      Platform.OS === 'tvos'
    ) {
      // Use native implementation (10-50x faster!)
      console.log('[Crypto] Using native CommonCrypto implementation');

      // Convert salt to hex string for expo-crypto
      const saltHex = Array.from(salt)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // Progress simulation for native (it's so fast we just show quick progress)
      const progressInterval = setInterval(() => {
        onProgress?.(0.5, 'Processing with native crypto...');
      }, 100);

      // This uses CommonCrypto on iOS/tvOS - VERY FAST!
      const keyBuffer = await ExpoCrypto.pbkdf2Async(
        passphrase,
        saltHex,
        iterations,
        32, // key length in bytes
        ExpoCrypto.CryptoDigestAlgorithm.SHA256
      );

      clearInterval(progressInterval);

      // Convert ArrayBuffer to Uint8Array
      const result = new Uint8Array(keyBuffer);

      const elapsed = Date.now() - startTime;
      console.log(`[Crypto] Native derivation completed in ${elapsed}ms`);
      onProgress?.(1, `Completed in ${(elapsed / 1000).toFixed(1)}s`);

      return result;
    } else {
      // Web fallback to JavaScript implementation
      console.log('[Crypto] Using JavaScript implementation for web');
      const { pbkdf2 } = await import('@noble/hashes/pbkdf2');
      const { sha256 } = await import('@noble/hashes/sha256');

      // For web, just run it directly (fast enough)
      const result = pbkdf2(sha256, passphrase, salt, {
        c: iterations,
        dkLen: 32,
      });

      const elapsed = Date.now() - startTime;
      console.log(`[Crypto] Web derivation completed in ${elapsed}ms`);
      onProgress?.(1, 'Key derivation complete');

      return result;
    }
  } catch (error) {
    console.error('[Crypto] Key derivation error:', error);
    throw error;
  }
}

/**
 * Benchmarks the native vs JavaScript implementations
 */
export async function benchmarkCrypto() {
  const testPassphrase = 'test_passphrase_123';
  const testSalt = new Uint8Array(16).fill(42);
  const testIterations = 100000;

  console.log('=== Crypto Benchmark ===');

  // Test native
  if (Platform.OS !== 'web') {
    const nativeStart = Date.now();
    await deriveKeyNative(testPassphrase, testSalt, testIterations);
    const nativeTime = Date.now() - nativeStart;
    console.log(`Native (${testIterations} iterations): ${nativeTime}ms`);
  }

  // Test JavaScript
  const { pbkdf2 } = await import('@noble/hashes/pbkdf2');
  const { sha256 } = await import('@noble/hashes/sha256');

  const jsStart = Date.now();
  pbkdf2(sha256, testPassphrase, testSalt, {
    c: testIterations,
    dkLen: 32,
  });
  const jsTime = Date.now() - jsStart;
  console.log(`JavaScript (${testIterations} iterations): ${jsTime}ms`);

  if (Platform.OS !== 'web') {
    const nativeStart = Date.now();
    await deriveKeyNative(testPassphrase, testSalt, testIterations);
    const nativeTime = Date.now() - nativeStart;
    const speedup = jsTime / nativeTime;
    console.log(`Native is ${speedup.toFixed(1)}x faster than JavaScript`);
  }
}
