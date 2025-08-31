'use client';

import { InteractionManager, Platform } from 'react-native';

/**
 * Optimized PBKDF2 implementation that balances security and performance.
 * Since we can't use native crypto on tvOS, we optimize the JavaScript version.
 */
export async function deriveKeyOptimized(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  onProgress?: (progress: number, message?: string) => void
): Promise<Uint8Array> {
  const { pbkdf2 } = await import('@noble/hashes/pbkdf2');
  const { sha256 } = await import('@noble/hashes/sha256');

  console.log(
    `[Crypto] Starting optimized key derivation with ${iterations} iterations`
  );
  const startTime = Date.now();

  // Report start
  onProgress?.(
    0.05,
    `Starting key derivation (${iterations.toLocaleString()} iterations)`
  );

  // For mobile/tvOS: Use InteractionManager to run after animations
  // This at least ensures smooth transition animations
  if (Platform.OS !== 'web' && InteractionManager?.runAfterInteractions) {
    return new Promise((resolve, reject) => {
      // Let UI settle first
      InteractionManager.runAfterInteractions(() => {
        try {
          // Show progress right before heavy computation
          onProgress?.(0.1, 'Processing encryption key...');

          // Run the computation
          const result = pbkdf2(sha256, passphrase, salt, {
            c: iterations,
            dkLen: 32,
          });

          const elapsed = Date.now() - startTime;
          console.log(`[Crypto] Key derivation completed in ${elapsed}ms`);
          onProgress?.(1, `Completed in ${(elapsed / 1000).toFixed(1)}s`);

          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  } else {
    // Web or fallback: just run it directly
    const result = pbkdf2(sha256, passphrase, salt, {
      c: iterations,
      dkLen: 32,
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Crypto] Key derivation completed in ${elapsed}ms`);
    onProgress?.(1, 'Key derivation complete');

    return result;
  }
}

/**
 * Alternative: Adaptive iteration count based on platform capabilities
 * This provides a balance between security and usability.
 */
export function getOptimalIterations(): number {
  // These values provide reasonable security while being usable
  if (Platform.OS === 'web') {
    return 500000; // Web can handle it
  } else if (Platform.OS === 'ios') {
    // Check if it's simulator or real device
    // @ts-ignore
    const isSimulator = __DEV__ && !global.nativePerformanceNow;
    return isSimulator ? 200000 : 300000; // Reduce for simulator
  } else if (Platform.OS === 'tvos') {
    return 200000; // tvOS devices are generally less powerful
  } else if (Platform.OS === 'android') {
    return 250000; // Android varies widely
  }
  return 500000; // Default to maximum security
}

/**
 * Security comparison:
 * 100,000 iterations = ~2015 standard (now considered minimum)
 * 200,000 iterations = Good for 2020+ (reasonable for mobile)
 * 300,000 iterations = Strong for 2023+
 * 500,000 iterations = Excellent for 2024+
 *
 * With server-side double encryption, even 200k is very secure.
 */
