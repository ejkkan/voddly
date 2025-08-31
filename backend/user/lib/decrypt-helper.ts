import * as crypto from 'crypto';
import { userDB } from '../db';
import { getServerEncryption } from './encryption-service';

interface EncryptionData {
  master_key_wrapped: string;
  server_wrapped_key: string;
  server_iv: string;
  salt: string;
  iv: string;
  kdf_iterations: number;
}

/**
 * Decrypt master key - always uses 500k iterations and double-layer encryption
 */
export async function decryptMasterKey(
  accountId: string,
  passphrase: string
): Promise<Buffer> {
  // Get encryption data from database
  const encData = await userDB.queryRow<EncryptionData>`
    SELECT 
      master_key_wrapped,
      server_wrapped_key,
      server_iv,
      salt,
      iv,
      kdf_iterations
    FROM subscription_encryption
    WHERE subscription_id = ${accountId}
  `;

  if (!encData) {
    throw new Error('No encryption data found for account');
  }

  const salt = Buffer.from(encData.salt, 'base64');
  const iv = Buffer.from(encData.iv, 'base64');
  
  // Always use 500k iterations (or what's stored, but should always be 500k)
  const iterations = encData.kdf_iterations || 500000;
  console.log(`[Decrypt] Using ${iterations} iterations for key derivation`);
  
  const derivedKey = crypto.pbkdf2Sync(
    passphrase,
    salt,
    iterations,
    32,
    'sha256'
  );

  // Always unwrap server layer first
  console.log('[Decrypt] Unwrapping server encryption layer');
  const serverEncryption = getServerEncryption();
  const userWrapped = await serverEncryption.serverUnwrap(
    encData.server_wrapped_key,
    encData.server_iv
  );

  // Then unwrap user layer
  const authTag = userWrapped.slice(-16);
  const ciphertext = userWrapped.slice(0, -16);
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);
  
  const masterKey = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return masterKey;
}