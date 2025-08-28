/**
 * Performance test script to compare crypto implementations
 * Run this in your React Native app to see the performance difference
 */

import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { deriveKeyOptimized, deriveKeyWithProgress, CryptoConfig } from './crypto-performance-optimized';

export async function testCryptoPerformance() {
  const passphrase = 'test123';
  const salt = new Uint8Array(16).fill(1);
  
  console.log('=== Crypto Performance Test ===');
  console.log(`Platform: ${CryptoConfig.isWeb ? 'Web' : 'Mobile'}`);
  console.log('');
  
  // Test 1: Original implementation (10,000 iterations)
  console.log('Test 1: Original PBKDF2 (10,000 iterations)');
  const start1 = performance.now();
  const result1 = pbkdf2(sha256, passphrase, salt, {
    c: 10000,
    dkLen: 32,
  });
  const time1 = performance.now() - start1;
  console.log(`Time: ${time1.toFixed(2)}ms`);
  console.log('');
  
  // Test 2: Optimized for mobile (1,000 iterations)
  console.log('Test 2: Optimized PBKDF2 (1,000 iterations)');
  const start2 = performance.now();
  const result2 = pbkdf2(sha256, passphrase, salt, {
    c: 1000,
    dkLen: 32,
  });
  const time2 = performance.now() - start2;
  console.log(`Time: ${time2.toFixed(2)}ms`);
  console.log(`Speedup: ${(time1 / time2).toFixed(1)}x faster`);
  console.log('');
  
  // Test 3: Async optimized version
  console.log('Test 3: Async Optimized (non-blocking)');
  const start3 = performance.now();
  const result3 = await deriveKeyOptimized(passphrase, salt, {
    iterations: 1000,
    useAsync: true,
  });
  const time3 = performance.now() - start3;
  console.log(`Time: ${time3.toFixed(2)}ms`);
  console.log('Note: This version does not block the UI thread');
  console.log('');
  
  // Test 4: With progress callback
  console.log('Test 4: With Progress Callback');
  let lastProgress = 0;
  const start4 = performance.now();
  const result4 = await deriveKeyWithProgress(
    passphrase,
    salt,
    (progress) => {
      if (progress - lastProgress >= 20) {
        console.log(`Progress: ${progress}%`);
        lastProgress = progress;
      }
    },
    1000
  );
  const time4 = performance.now() - start4;
  console.log(`Time: ${time4.toFixed(2)}ms`);
  console.log('');
  
  // Summary
  console.log('=== Summary ===');
  console.log(`Original (10k): ${time1.toFixed(2)}ms`);
  console.log(`Optimized (1k): ${time2.toFixed(2)}ms`);
  console.log(`Async Optimized: ${time3.toFixed(2)}ms`);
  console.log(`With Progress: ${time4.toFixed(2)}ms`);
  console.log(`Overall speedup: ${(time1 / time2).toFixed(1)}x`);
  
  return {
    original: time1,
    optimized: time2,
    async: time3,
    withProgress: time4,
    speedup: time1 / time2,
  };
}

// Export for use in components
export { testCryptoPerformance as default };