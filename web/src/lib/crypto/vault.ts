// Minimal client-side vault helpers using Web Crypto (PBKDF2 + AES-GCM)

export type Base64Url = string;

export type CipherAlgo = "aes-gcm-256";

export interface EncryptedSecret {
  ciphertext: Base64Url;
  nonce: Base64Url;
  wrappedDek: Base64Url;
  wrappedDekNonce: Base64Url;
  cipherAlgo: CipherAlgo;
  version: number;
}

export interface KeyWrapMeta {
  wrappedAvk: Base64Url;
  wrapIv: Base64Url;
  kdfAlgo?: "pbkdf2";
  kdfSalt?: Base64Url;
  kdfParams?: { iterations: number; hash: "SHA-256" };
  wrapAlgo: "aes-gcm-256";
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes as ArrayBuffer));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Derive a KEK from a passphrase with PBKDF2 (intentionally high iterations)
export async function deriveKekFromPassphrase(passphrase: string, salt?: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const useSalt = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const iterations = 310_000;
  const kek = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: useSalt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    true,
    ["wrapKey", "unwrapKey", "encrypt", "decrypt"],
  );
  return { kek, salt: useSalt, iterations };
}

export async function generateAvk(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "wrapKey",
    "unwrapKey",
    "encrypt",
    "decrypt",
  ]);
}

export async function exportRawKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

export async function importAesGcmKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, true, [
    "wrapKey",
    "unwrapKey",
    "encrypt",
    "decrypt",
  ]);
}

export async function wrapAvkWithKek(
  avk: CryptoKey,
  kek: CryptoKey,
): Promise<KeyWrapMeta> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.wrapKey("raw", avk, kek, { name: "AES-GCM", iv });
  return {
    wrappedAvk: b64url(wrapped),
    wrapIv: b64url(iv),
    kdfAlgo: "pbkdf2",
    kdfParams: { iterations: 310_000, hash: "SHA-256" },
    wrapAlgo: "aes-gcm-256",
  };
}

export async function unwrapAvkWithKek(
  meta: KeyWrapMeta,
  kek: CryptoKey,
): Promise<CryptoKey> {
  const iv = fromB64url(meta.wrapIv);
  const wrapped = fromB64url(meta.wrappedAvk);
  return crypto.subtle.unwrapKey(
    "raw",
    wrapped,
    kek,
    { name: "AES-GCM", iv },
    { name: "AES-GCM", length: 256 },
    true,
    ["wrapKey", "unwrapKey", "encrypt", "decrypt"],
  );
}

export async function encryptSecretJson(
  json: any,
  avk: CryptoKey,
): Promise<EncryptedSecret> {
  const dek = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const dekIv = crypto.getRandomValues(new Uint8Array(12));
  const data = enc.encode(JSON.stringify(json));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: dekIv },
    dek,
    data,
  );

  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedDek = await crypto.subtle.wrapKey("raw", dek, avk, {
    name: "AES-GCM",
    iv: wrapIv,
  });

  return {
    ciphertext: b64url(ciphertext),
    nonce: b64url(dekIv),
    wrappedDek: b64url(wrappedDek),
    wrappedDekNonce: b64url(wrapIv),
    cipherAlgo: "aes-gcm-256",
    version: 1,
  };
}

export async function decryptSecretJson(
  secret: EncryptedSecret,
  avk: CryptoKey,
): Promise<any> {
  const dek = await crypto.subtle.unwrapKey(
    "raw",
    fromB64url(secret.wrappedDek),
    avk,
    { name: "AES-GCM", iv: fromB64url(secret.wrappedDekNonce) },
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64url(secret.nonce) },
    dek,
    fromB64url(secret.ciphertext),
  );
  return JSON.parse(dec.decode(new Uint8Array(plaintext)));
}
