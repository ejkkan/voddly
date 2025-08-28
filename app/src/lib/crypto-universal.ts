/**
 * Universal crypto implementation that works on ALL platforms:
 * - iOS/Android (React Native)
 * - Web browsers
 * - tvOS
 * - Node.js (backend)
 */

'use client';

import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';

// Platform detection
const PLATFORM = (() => {
  // Check for React Native
  if (typeof global !== 'undefined' && global.nativeCallSyncHook) {
    // Check for tvOS
    if (typeof global.Platform !== 'undefined') {
      const Platform = global.Platform as any;
      if (Platform.isTVOS || Platform.isTV) {
        return 'tvos';
      }
    }
    return 'mobile';
  }
  
  // Check for web browser
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    return 'web';
  }
  
  // Check for Node.js
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'node';
  }
  
  // Default to mobile for unknown React Native environments
  return 'mobile';
})();

// Platform-specific iteration counts
const ITERATION_COUNTS = {
  tvos: 500,    // Lowest for TV devices (limited CPU)
  mobile: 1000, // Low for phones
  web: 5000,    // Medium for browsers
  node: 10000,  // Highest for backend servers
};

// Get iteration count for current platform
const DEFAULT_ITERATIONS = ITERATION_COUNTS[PLATFORM] || 1000;

console.log(`[CryptoUniversal] Platform detected: ${PLATFORM}, iterations: ${DEFAULT_ITERATIONS}`);

/**
 * Universal key derivation that works on all platforms
 * No platform-specific imports required
 */
export async function deriveKeyUniversal(
  passphrase: string,
  salt: Uint8Array,
  options?: {
    iterations?: number;
    onProgress?: (progress: number) => void;
  }
): Promise<Uint8Array> {
  const iterations = options?.iterations || DEFAULT_ITERATIONS;
  
  // For progress reporting, we need to chunk the work
  if (options?.onProgress) {
    return deriveKeyWithProgressUniversal(passphrase, salt, iterations, options.onProgress);
  }
  
  // Simple direct derivation
  return pbkdf2(sha256, passphrase, salt, {
    c: iterations,
    dkLen: 32,
  });
}

/**
 * Chunked derivation with progress for all platforms
 */
async function deriveKeyWithProgressUniversal(
  passphrase: string,
  salt: Uint8Array,
  totalIterations: number,
  onProgress: (progress: number) => void
): Promise<Uint8Array> {
  // For very low iteration counts, just do it all at once
  if (totalIterations <= 100) {
    const result = pbkdf2(sha256, passphrase, salt, {
      c: totalIterations,
      dkLen: 32,
    });
    onProgress(100);
    return result;
  }
  
  // Split into chunks for progress reporting
  const chunkSize = Math.max(50, Math.floor(totalIterations / 20));
  let result = new TextEncoder().encode(passphrase);
  let completed = 0;
  
  while (completed < totalIterations) {
    const remaining = totalIterations - completed;
    const currentChunk = Math.min(chunkSize, remaining);
    
    // Derive next chunk
    result = pbkdf2(sha256, result, salt, {
      c: currentChunk,
      dkLen: 32,
    });
    
    completed += currentChunk;
    
    // Report progress
    const progress = Math.round((completed / totalIterations) * 100);
    onProgress(progress);
    
    // Yield to event loop (works on all platforms)
    if (completed < totalIterations) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return result;
}

/**
 * Async wrapper that yields to event loop
 * Works on all platforms without platform-specific APIs
 */
export async function deriveKeyAsync(
  passphrase: string,
  salt: Uint8Array,
  iterations?: number
): Promise<Uint8Array> {
  // Yield to event loop before heavy computation
  await new Promise(resolve => setTimeout(resolve, 0));
  
  const result = pbkdf2(sha256, passphrase, salt, {
    c: iterations || DEFAULT_ITERATIONS,
    dkLen: 32,
  });
  
  // Yield again after computation
  await new Promise(resolve => setTimeout(resolve, 0));
  
  return result;
}

/**
 * Fast hash for non-critical operations
 * Works everywhere
 */
export function fastHash(input: string): Uint8Array {
  return sha256(input);
}

/**
 * Get platform info for debugging
 */
export function getPlatformInfo() {
  return {
    platform: PLATFORM,
    iterations: DEFAULT_ITERATIONS,
    description: {
      tvos: 'Apple TV (lowest security, best performance)',
      mobile: 'iOS/Android (balanced)',
      web: 'Web Browser (good performance)',
      node: 'Node.js Backend (highest security)',
    }[PLATFORM] || 'Unknown platform',
  };
}

// Export configuration
export const UniversalCryptoConfig = {
  platform: PLATFORM,
  defaultIterations: DEFAULT_ITERATIONS,
  iterationCounts: ITERATION_COUNTS,
};