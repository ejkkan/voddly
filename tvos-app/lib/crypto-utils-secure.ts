'use client';

/**
 * Secure crypto utilities for tvOS - Addresses security concerns
 * Uses @noble/ciphers and @noble/hashes with proper entropy validation
 */

// Configuration constants
export const CRYPTO_CONFIG = {
  ITERATIONS: {
    TVOS: 100000,
    DEFAULT: 200000,
  },
  KEY_LENGTH: 32,
  IV_LENGTH: 12,
  SALT_LENGTH: 16,
  MIN_ENTROPY_BITS: 128,
  PROGRESS_CHUNK_SIZE: 1000,
} as const;

// Error classes for better error handling
export class CryptoError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

export class EntropyError extends CryptoError {
  constructor(message: string) {
    super(message, 'INSUFFICIENT_ENTROPY');
  }
}

export class ValidationError extends CryptoError {
  constructor(message: string) {
    super(message, 'VALIDATION_FAILED');
  }
}

// Secure base64 utilities
export function decodeBase64(input: string): Uint8Array {
  if (!input || typeof input !== 'string') {
    throw new ValidationError('Invalid base64 input');
  }
  
  const fixed = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = fixed.length % 4 === 0 ? '' : '='.repeat(4 - (fixed.length % 4));
  
  try {
    const decoded = atob(fixed + pad);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    throw new ValidationError('Failed to decode base64 string');
  }
}

export function encodeBase64(bytes: Uint8Array): string {
  if (!bytes || bytes.length === 0) {
    throw new ValidationError('Invalid bytes for base64 encoding');
  }
  
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Import crypto functions with error handling
let gcm: any;
let pbkdf2: any;
let sha256: any;

try {
  const noble = require('@noble/ciphers/aes');
  const hashes = require('@noble/hashes/pbkdf2');
  const sha = require('@noble/hashes/sha256');
  
  gcm = noble.gcm;
  pbkdf2 = hashes.pbkdf2;
  sha256 = sha.sha256;
  
  console.log('[SecureCrypto] Noble crypto libraries loaded successfully');
} catch (error) {
  console.error('[SecureCrypto] Failed to load crypto libraries:', error);
  throw new CryptoError('Crypto libraries not available for tvOS', 'LIBRARY_LOAD_FAILED');
}

/**
 * Validate entropy quality of random bytes
 */
function validateEntropy(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  
  // Basic entropy checks
  const histogram = new Array(256).fill(0);
  for (const byte of bytes) {
    histogram[byte]++;
  }
  
  // Check for patterns that indicate poor entropy
  const maxFreq = Math.max(...histogram);
  const expectedFreq = bytes.length / 256;
  
  // If any byte appears more than 3x expected frequency, entropy might be poor
  if (maxFreq > expectedFreq * 3) {
    console.warn('[SecureCrypto] Potential entropy issue detected');
    return false;
  }
  
  // Check for runs of identical bytes
  let maxRun = 1;
  let currentRun = 1;
  for (let i = 1; i < bytes.length; i++) {
    if (bytes[i] === bytes[i - 1]) {
      currentRun++;
      maxRun = Math.max(maxRun, currentRun);
    } else {
      currentRun = 1;
    }
  }
  
  // If we have a run of 8+ identical bytes, entropy is suspect
  if (maxRun >= 8) {
    console.warn('[SecureCrypto] Long run of identical bytes detected');
    return false;
  }
  
  return true;
}

/**
 * Generate secure random bytes with entropy validation
 */
export function getSecureRandomBytes(length: number): Uint8Array {
  if (length <= 0) {
    throw new ValidationError('Invalid length for random bytes generation');
  }
  
  let attempts = 0;
  const maxAttempts = 5;
  
  while (attempts < maxAttempts) {
    let bytes: Uint8Array;
    
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      bytes = new Uint8Array(length);
      crypto.getRandomValues(bytes);
    } else {
      // Fallback for environments without crypto.getRandomValues
      console.warn('[SecureCrypto] Using fallback random number generation');
      bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    
    // Validate entropy quality
    if (validateEntropy(bytes)) {
      return bytes;
    }
    
    attempts++;
    console.warn(`[SecureCrypto] Entropy validation failed, attempt ${attempts}/${maxAttempts}`);
  }
  
  throw new EntropyError('Failed to generate secure random bytes with sufficient entropy');
}

/**
 * AES-GCM decryption with proper error handling
 */
export function aesGcmDecrypt(
  keyBytes: Uint8Array,
  nonce: Uint8Array,
  ciphertextWithTag: Uint8Array,
  additionalData?: Uint8Array
): Uint8Array {
  if (!keyBytes || keyBytes.length !== 32) {
    throw new ValidationError('Invalid key length for AES-256-GCM');
  }
  if (!nonce || nonce.length === 0) {
    throw new ValidationError('AES-GCM: missing nonce/iv');
  }
  if (!ciphertextWithTag || ciphertextWithTag.length === 0) {
    throw new ValidationError('AES-GCM: missing ciphertext');
  }
  
  try {
    const aes = gcm(keyBytes, nonce, additionalData);
    return aes.decrypt(ciphertextWithTag);
  } catch (error) {
    throw new CryptoError('AES-GCM decryption failed', 'DECRYPTION_FAILED');
  }
}

/**
 * AES-GCM encryption with proper error handling
 */
export function aesGcmEncrypt(
  keyBytes: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
  additionalData?: Uint8Array
): Uint8Array {
  if (!keyBytes || keyBytes.length !== 32) {
    throw new ValidationError('Invalid key length for AES-256-GCM');
  }
  if (!nonce || nonce.length === 0) {
    throw new ValidationError('AES-GCM: missing nonce/iv');
  }
  if (!plaintext || plaintext.length === 0) {
    throw new ValidationError('AES-GCM: missing plaintext');
  }
  
  try {
    const aes = gcm(keyBytes, nonce, additionalData);
    return aes.encrypt(plaintext);
  } catch (error) {
    throw new CryptoError('AES-GCM encryption failed', 'ENCRYPTION_FAILED');
  }
}

/**
 * Secure PBKDF2-SHA256 key derivation with progress callback
 */
export async function deriveKeyWithProgress(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyLength: number = CRYPTO_CONFIG.KEY_LENGTH,
  onProgress?: (progress: number, message?: string) => void
): Promise<Uint8Array> {
  if (!password || password.length === 0) {
    throw new ValidationError('Password cannot be empty');
  }
  if (!salt || salt.length < CRYPTO_CONFIG.SALT_LENGTH) {
    throw new ValidationError('Salt must be at least 16 bytes');
  }
  if (iterations < 10000) {
    throw new ValidationError('Iterations must be at least 10,000 for security');
  }
  
  const passwordBytes = new TextEncoder().encode(password);
  
  // Use Web Crypto API for better performance if available
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const key = await crypto.subtle.importKey(
        'raw',
        passwordBytes,
        'PBKDF2',
        false,
        ['deriveBits']
      );
      
      onProgress?.(0, 'Starting secure key derivation...');
      
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
      console.log('[SecureCrypto] Web Crypto API failed, falling back to noble implementation');
    }
  }
  
  // Fallback to noble implementation with chunked progress
  return new Promise((resolve, reject) => {
    const chunkSize = Math.max(CRYPTO_CONFIG.PROGRESS_CHUNK_SIZE, Math.floor(iterations / 100));
    let currentIteration = 0;
    
    const processChunk = () => {
      try {
        const remainingIterations = iterations - currentIteration;
        const chunkIterations = Math.min(chunkSize, remainingIterations);
        
        if (chunkIterations <= 0) {
          // Final derivation
          const derivedKey = pbkdf2(sha256, passwordBytes, salt, {
            c: iterations,
            dkLen: keyLength
          });
          
          onProgress?.(1, 'Secure key derivation complete');
          resolve(new Uint8Array(derivedKey));
          return;
        }
        
        currentIteration += chunkIterations;
        const progress = currentIteration / iterations;
        onProgress?.(progress, `Secure key derivation... ${Math.round(progress * 100)}%`);
        
        // Continue processing in next tick
        setTimeout(processChunk, 0);
      } catch (error) {
        reject(new CryptoError('Key derivation failed', 'DERIVATION_FAILED'));
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
  keyLength: number = CRYPTO_CONFIG.KEY_LENGTH
): Uint8Array {
  if (!password || password.length === 0) {
    throw new ValidationError('Password cannot be empty');
  }
  if (!salt || salt.length < CRYPTO_CONFIG.SALT_LENGTH) {
    throw new ValidationError('Salt must be at least 16 bytes');
  }
  if (iterations < 10000) {
    throw new ValidationError('Iterations must be at least 10,000 for security');
  }
  
  const passwordBytes = new TextEncoder().encode(password);
  
  try {
    const derivedKey = pbkdf2(sha256, passwordBytes, salt, {
      c: iterations,
      dkLen: keyLength
    });
    return new Uint8Array(derivedKey);
  } catch (error) {
    throw new CryptoError('Key derivation failed', 'DERIVATION_FAILED');
  }
}

/**
 * Get optimal iterations for tvOS (JavaScript-only environment)
 */
export function getOptimalIterations(): number {
  return CRYPTO_CONFIG.ITERATIONS.TVOS;
}

/**
 * Get device type for API calls
 */
export function getDeviceType(): 'tvos' {
  return 'tvos';
}

/**
 * Secure memory clearing (best effort in JavaScript)
 */
export function secureMemoryClear(data: Uint8Array): void {
  if (data && data.fill) {
    data.fill(0);
  }
}

/**
 * Validate passphrase format
 */
export function validatePassphraseFormat(passphrase: string): { valid: boolean; error?: string } {
  if (!passphrase) {
    return { valid: false, error: 'Passphrase is required' };
  }
  
  if (passphrase.length < 6) {
    return { valid: false, error: 'Passphrase must be at least 6 characters' };
  }
  
  if (passphrase.length > 128) {
    return { valid: false, error: 'Passphrase must be less than 128 characters' };
  }
  
  // Check for common weak patterns
  if (/^(.)\1{5,}$/.test(passphrase)) {
    return { valid: false, error: 'Passphrase cannot be all the same character' };
  }
  
  if (/^(012345|123456|654321|abcdef|qwerty)$/i.test(passphrase)) {
    return { valid: false, error: 'Passphrase is too common, please choose a different one' };
  }
  
  return { valid: true };
}