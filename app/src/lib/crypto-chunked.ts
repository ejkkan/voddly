'use client';

import { InteractionManager } from 'react-native';

export type ProgressCallback = (progress: number, message?: string) => void;

/**
 * Derives a key using PBKDF2 with UI-friendly processing.
 * Note: PBKDF2 cannot be truly chunked - it must run all iterations in sequence.
 * This implementation runs the full computation but yields periodically to update UI.
 */
export async function deriveLightweightKeyChunked(
  passphrase: string,
  salt: Uint8Array,
  totalIterations: number,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  console.log(
    `[Crypto] Starting key derivation with ${totalIterations} iterations`
  );
  const startTime = Date.now();

  // Import the crypto libraries
  const { pbkdf2 } = await import('@noble/hashes/pbkdf2');
  const { sha256 } = await import('@noble/hashes/sha256');

  // For mobile/tvOS: Run with periodic UI updates
  // The computation runs synchronously but we yield periodically

  onProgress?.(
    0,
    `Starting key derivation (${totalIterations.toLocaleString()} iterations)`
  );

  // Start progress animation
  let progressValue = 0;
  let completed = false;

  // Progress updater that runs while computation happens
  const progressUpdater = async () => {
    while (!completed && progressValue < 0.95) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (!completed) {
        progressValue = Math.min(progressValue + 0.05, 0.95);
        const elapsed = (Date.now() - startTime) / 1000;
        onProgress?.(
          progressValue,
          `Deriving key... ${Math.round(progressValue * 100)}% (${elapsed.toFixed(1)}s)`
        );
      }
    }
  };

  // Start the progress updater
  const progressPromise = progressUpdater();

  // Perform the actual PBKDF2 computation
  // This MUST run all iterations at once to get the correct result
  const result = await new Promise<Uint8Array>((resolve) => {
    // Use setImmediate/setTimeout to avoid blocking initially
    const runComputation = () => {
      try {
        console.log('[Crypto] Running PBKDF2 computation...');
        const keyBytes = pbkdf2(sha256, passphrase, salt, {
          c: totalIterations,
          dkLen: 32,
        });
        resolve(keyBytes);
      } catch (error) {
        console.error('[Crypto] PBKDF2 error:', error);
        throw error;
      }
    };

    // On React Native, use InteractionManager if available
    if (InteractionManager?.runAfterInteractions) {
      InteractionManager.runAfterInteractions(runComputation);
    } else {
      setTimeout(runComputation, 0);
    }
  });

  // Mark as completed and update progress
  completed = true;
  await progressPromise; // Wait for progress updater to finish

  onProgress?.(1, 'Key derivation complete');

  const elapsed = Date.now() - startTime;
  console.log(`[Crypto] Key derivation completed in ${elapsed}ms`);

  return result;
}

/**
 * Synchronous version for web platform where blocking is less of an issue
 */
export async function deriveLightweightKeySync(
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const { pbkdf2 } = await import('@noble/hashes/pbkdf2');
  const { sha256 } = await import('@noble/hashes/sha256');

  console.log(`[Crypto] Deriving key with ${iterations} iterations (sync)...`);
  const startTime = Date.now();

  const result = pbkdf2(sha256, passphrase, salt, {
    c: iterations,
    dkLen: 32,
  });

  const elapsed = Date.now() - startTime;
  console.log(`[Crypto] Key derivation completed in ${elapsed}ms`);

  return result;
}
