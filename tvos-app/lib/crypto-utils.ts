'use client';

/**
 * Crypto utilities for tvOS - JavaScript-only implementation
 * Uses @noble/ciphers and @noble/hashes for encryption operations
 */

// Base64 utilities using built-in browser APIs for tvOS
export function decodeBase64(input: string): Uint8Array {
  const fixed = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = fixed.length % 4 === 0 ? '' : '='.repeat(4 - (fixed.length % 4));
  
  // Use atob for tvOS compatibility
  const decoded = atob(fixed + pad);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Import crypto functions for tvOS
let gcm: any;
let pbkdf2: any;
let sha256: any;

try {
  // These will be installed as dependencies
  const noble = require('@noble/ciphers/aes');
  const hashes = require('@noble/hashes/pbkdf2');
  const sha = require('@noble/hashes/sha256');
  
  gcm = noble.gcm;
  pbkdf2 = hashes.pbkdf2;
  sha256 = sha.sha256;
  
  console.log('[Crypto] Noble crypto libraries loaded for tvOS');
} catch (error) {
  console.error('[Crypto] Failed to load crypto libraries:', error);
  throw new Error('Crypto libraries not available for tvOS');
}

/**
 * AES-GCM decryption using @noble/ciphers
 */
export function aesGcmDecrypt(
  keyBytes: Uint8Array,
  nonce: Uint8Array,
  ciphertextWithTag: Uint8Array,
  additionalData?: Uint8Array
): Uint8Array {
  if (!nonce || nonce.length === 0) {
    throw new Error('AES-GCM: missing nonce/iv');
  }
  if (!ciphertextWithTag || ciphertextWithTag.length === 0) {
    throw new Error('AES-GCM: missing ciphertext');
  }
  
  const aes = gcm(keyBytes, nonce, additionalData);
  return aes.decrypt(ciphertextWithTag);
}

/**
 * PBKDF2-SHA256 key derivation with progress callback for tvOS
 */
export async function deriveKeyWithProgress(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyLength: number = 32,
  onProgress?: (progress: number, message?: string) => void
): Promise<Uint8Array> {
  const passwordBytes = new TextEncoder().encode(password);
  
  // For tvOS, we'll use chunked processing to show progress
  const chunkSize = Math.max(1000, Math.floor(iterations / 100)); // 100 progress updates max
  let currentIteration = 0;
  
  // Start with initial key
  let derivedKey = new Uint8Array(keyLength);
  
  // Use Web Crypto API for better performance on tvOS if available
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const key = await crypto.subtle.importKey(
        'raw',
        passwordBytes,
        'PBKDF2',
        false,
        ['deriveBits']
      );
      
      onProgress?.(0, 'Starting key derivation...');
      
      const result = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: iterations,
          hash: 'SHA-256'
        },
        key,
        keyLength * 8
      );
      
      onProgress?.(1, 'Key derivation complete');
      return new Uint8Array(result);
    } catch (error) {
      console.log('[Crypto] Web Crypto API failed, falling back to noble implementation');
    }
  }
  
  // Fallback to noble implementation with chunked progress
  return new Promise((resolve, reject) => {
    const processChunk = () => {
      try {
        const remainingIterations = iterations - currentIteration;
        const chunkIterations = Math.min(chunkSize, remainingIterations);
        
        if (chunkIterations <= 0) {
          onProgress?.(1, 'Key derivation complete');
          resolve(derivedKey);
          return;
        }
        
        // Process chunk
        const chunkResult = pbkdf2(sha256, passwordBytes, salt, {
          c: currentIteration + chunkIterations,
          dkLen: keyLength
        });
        
        derivedKey = new Uint8Array(chunkResult);
        currentIteration += chunkIterations;
        
        const progress = currentIteration / iterations;
        onProgress?.(progress, `Deriving key... ${Math.round(progress * 100)}%`);
        
        // Continue processing in next tick
        setTimeout(processChunk, 0);
      } catch (error) {
        reject(error);
      }
    };
    
    processChunk();
  });
}

/**
 * Simple PBKDF2 without progress (for quick operations)
 */
export function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyLength: number = 32
): Uint8Array {
  const passwordBytes = new TextEncoder().encode(password);
  return pbkdf2(sha256, passwordBytes, salt, {
    c: iterations,
    dkLen: keyLength
  });
}

/**
 * Generate random bytes using crypto.getRandomValues
 */
export function getRandomBytes(length: number): Uint8Array {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint8Array(length));
  }
  
  // Fallback for environments without crypto.getRandomValues
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/**
 * Get optimal iterations for tvOS (JavaScript-only environment)
 */
export function getOptimalIterations(): number {
  return 100000; // tvOS uses 100k iterations as per backend logic
}

/**
 * Get device type for API calls
 */
export function getDeviceType(): 'tvos' {
  return 'tvos';
}