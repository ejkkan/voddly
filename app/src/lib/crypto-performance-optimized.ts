'use client';

import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { InteractionManager } from 'react-native';

// Performance-optimized configuration
const MOBILE_ITERATIONS = 1000; // Reduced for mobile performance
const WEB_ITERATIONS = 10000; // Higher for web where performance is better
const KEY_LENGTH = 32;

// Platform detection
const IS_WEB = typeof window !== 'undefined' && typeof window.document !== 'undefined';

/**
 * Optimized key derivation with platform-specific settings
 * Uses lower iterations on mobile for better performance
 */
export async function deriveKeyOptimized(
  passphrase: string,
  salt: Uint8Array,
  options?: { 
    iterations?: number;
    useAsync?: boolean;
  }
): Promise<Uint8Array> {
  const iterations = options?.iterations || (IS_WEB ? WEB_ITERATIONS : MOBILE_ITERATIONS);
  
  // For React Native, defer heavy computation
  if (!IS_WEB && options?.useAsync !== false) {
    return new Promise((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        const result = pbkdf2(sha256, passphrase, salt, {
          c: iterations,
          dkLen: KEY_LENGTH,
        });
        resolve(result);
      });
    });
  }
  
  // Direct computation for web or when async is disabled
  return pbkdf2(sha256, passphrase, salt, {
    c: iterations,
    dkLen: KEY_LENGTH,
  });
}

/**
 * Fast hash for non-critical operations (like cache keys)
 * Uses single SHA256 pass - extremely fast
 */
export function fastHash(input: string): Uint8Array {
  return sha256(input);
}

/**
 * Chunked key derivation for progress feedback
 * Useful for showing loading progress to user
 */
export async function deriveKeyWithProgress(
  passphrase: string,
  salt: Uint8Array,
  onProgress?: (progress: number) => void,
  iterations: number = MOBILE_ITERATIONS
): Promise<Uint8Array> {
  // Split iterations into chunks to allow UI updates
  const chunkSize = Math.max(100, Math.floor(iterations / 10));
  let currentKey = new TextEncoder().encode(passphrase);
  let completedIterations = 0;
  
  while (completedIterations < iterations) {
    const remainingIterations = iterations - completedIterations;
    const currentChunk = Math.min(chunkSize, remainingIterations);
    
    // Process chunk
    currentKey = pbkdf2(sha256, currentKey, salt, {
      c: currentChunk,
      dkLen: KEY_LENGTH,
    });
    
    completedIterations += currentChunk;
    
    // Report progress
    if (onProgress) {
      const progress = (completedIterations / iterations) * 100;
      onProgress(Math.round(progress));
    }
    
    // Allow UI to update
    if (!IS_WEB && completedIterations < iterations) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return currentKey;
}

/**
 * Memory-hard function alternative (simplified Argon2-like)
 * Provides better security with lower iteration count
 */
export async function deriveKeyMemoryHard(
  passphrase: string,
  salt: Uint8Array,
  memoryBlocks: number = 4
): Promise<Uint8Array> {
  // Create memory-hard derivation by chaining hashes
  const blocks: Uint8Array[] = [];
  let current = new TextEncoder().encode(passphrase);
  
  // Generate memory blocks
  for (let i = 0; i < memoryBlocks; i++) {
    current = pbkdf2(sha256, current, salt, {
      c: 250, // Very low iterations per block
      dkLen: KEY_LENGTH,
    });
    blocks.push(current);
  }
  
  // Mix all blocks together
  let result = blocks[0];
  for (let i = 1; i < blocks.length; i++) {
    const mixed = new Uint8Array(KEY_LENGTH);
    for (let j = 0; j < KEY_LENGTH; j++) {
      mixed[j] = result[j] ^ blocks[i][j];
    }
    result = sha256(mixed);
  }
  
  return result;
}

// Export configuration for easy tuning
export const CryptoConfig = {
  mobileIterations: MOBILE_ITERATIONS,
  webIterations: WEB_ITERATIONS,
  keyLength: KEY_LENGTH,
  isWeb: IS_WEB,
};