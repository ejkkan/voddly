'use client';

import { gcm } from '@noble/ciphers/aes';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';

// Simple base64 implementation for tvOS (no base64-js dependency)
export function decodeBase64(input: string): Uint8Array {
  const fixed = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = fixed.length % 4 === 0 ? '' : '='.repeat(4 - (fixed.length % 4));
  const base64 = fixed + pad;
  
  // Use atob if available (web), otherwise use Buffer (node/react-native)
  if (typeof atob !== 'undefined') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } else if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  throw new Error('No base64 decoder available');
}

export function encodeBase64(bytes: Uint8Array): string {
  // Use btoa if available (web), otherwise use Buffer (node/react-native)
  if (typeof btoa !== 'undefined') {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } else if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  throw new Error('No base64 encoder available');
}

// PBKDF2-SHA256 is used for key derivation (optimized for mobile/TV)

export function aesGcmDecrypt(
  keyBytes: Uint8Array,
  nonce: Uint8Array,
  ciphertextWithTag: Uint8Array,
  additionalData?: Uint8Array
): Uint8Array {
  if (!nonce || nonce.length === 0)
    throw new Error('AES-GCM: missing nonce/iv');
  if (!ciphertextWithTag || ciphertextWithTag.length === 0)
    throw new Error('AES-GCM: missing ciphertext');
  
  const aes = gcm(keyBytes, nonce, additionalData);
  return aes.decrypt(ciphertextWithTag);
}

export function xchacha20Poly1305Decrypt(
  keyBytes: Uint8Array,
  nonce: Uint8Array,
  ciphertextWithTag: Uint8Array,
  additionalData?: Uint8Array
): Uint8Array {
  if (!nonce || nonce.length === 0)
    throw new Error('XChaCha20-Poly1305: missing nonce');
  if (!ciphertextWithTag || ciphertextWithTag.length === 0)
    throw new Error('XChaCha20-Poly1305: missing ciphertext');
  
  const aead = xchacha20poly1305(keyBytes, nonce, additionalData);
  return aead.decrypt(ciphertextWithTag);
}