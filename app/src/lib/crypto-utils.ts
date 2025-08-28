'use client';

import { gcm } from '@noble/ciphers/aes';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { fromByteArray, toByteArray } from 'base64-js';

export function decodeBase64(input: string): Uint8Array {
  const fixed = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = fixed.length % 4 === 0 ? '' : '='.repeat(4 - (fixed.length % 4));
  // base64-js throws on invalid input
  return toByteArray(fixed + pad);
}

export function encodeBase64(bytes: Uint8Array): string {
  // Return standard base64 (not URL-safe)
  return fromByteArray(bytes);
}

// PBKDF2-SHA256 is now used for key derivation

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
  // Intentionally no verbose logging in production builds
  // noble gcm API takes (key, nonce, aad?) to create a cipher instance
  // then decrypts combined ciphertext||tag
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
