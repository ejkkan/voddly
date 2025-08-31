import { api, APIError } from 'encore.dev/api';
import * as crypto from 'crypto';
import { userDB } from '../db';
import { getServerEncryption } from '../lib/encryption-service';

interface SetupAccountEncryptionRequest {
  accountId: string;
  passphrase: string;
  deviceId: string;
  deviceType: 'ios' | 'tvos' | 'android' | 'web';
  deviceName?: string;
  deviceModel?: string;
}

// Internal endpoint for auth service to call after account creation
export const setupAccountEncryption = api(
  {
    expose: false, // Internal only - not exposed to frontend
    auth: false, // No auth needed - this is called internally
    method: 'POST',
    path: '/internal/setup-account-encryption',
  },
  async (req: SetupAccountEncryptionRequest): Promise<{ success: boolean }> => {
    const { accountId, passphrase, deviceId, deviceType, deviceName, deviceModel } = req;

    console.log('[SetupEncryption] Setting up encryption for account:', accountId);

    // Check if encryption already exists
    const existingEncryption = await userDB.queryRow<{ subscription_id: string }>`
      SELECT subscription_id FROM subscription_encryption WHERE subscription_id = ${accountId}
    `;

    if (existingEncryption) {
      console.log('[SetupEncryption] Encryption already exists for account');
      return { success: true };
    }

    // Generate account master key
    const masterKey = crypto.randomBytes(32);

    // Derive key from passphrase
    const salt = crypto.randomBytes(16);
    const KDF_ITERATIONS = 100000;
    const derivedKey = crypto.pbkdf2Sync(
      passphrase,
      salt,
      KDF_ITERATIONS,
      32,
      'sha256'
    );

    // Encrypt master key with user's derived key
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    const encryptedMasterKey = cipher.update(masterKey);
    const finalMasterKey = cipher.final();
    const authTag = cipher.getAuthTag();
    const userWrapped = Buffer.concat([
      encryptedMasterKey,
      finalMasterKey,
      authTag,
    ]);

    // Add server-side encryption layer
    const serverEncryption = getServerEncryption();
    const { server_wrapped, server_iv } = await serverEncryption.doubleWrap(userWrapped);

    // Store encryption keys
    await userDB.exec`
      INSERT INTO subscription_encryption (
        subscription_id, 
        master_key_wrapped,
        server_wrapped_key,
        server_iv,
        salt, 
        iv,
        kdf_iterations
      ) VALUES (
        ${accountId}, 
        ${userWrapped.toString('base64')},
        ${server_wrapped},
        ${server_iv},
        ${salt.toString('base64')},
        ${iv.toString('base64')},
        ${KDF_ITERATIONS}
      )
    `;

    console.log('[SetupEncryption] Encryption initialized');

    // Register device
    const deviceIterations = deviceType === 'tvos' ? 100000 :
                             deviceType === 'android' ? 300000 :
                             deviceType === 'ios' ? 500000 : 500000;

    const deviceSalt = crypto.randomBytes(16);
    const deviceIv = crypto.randomBytes(12);

    // Derive device-specific key
    const deviceDerivedKey = crypto.pbkdf2Sync(
      passphrase,
      deviceSalt,
      deviceIterations,
      32,
      'sha256'
    );

    // Encrypt master key with device-specific key
    const deviceCipher = crypto.createCipheriv(
      'aes-256-gcm',
      deviceDerivedKey,
      deviceIv
    );
    const encryptedForDevice = Buffer.concat([
      deviceCipher.update(masterKey),
      deviceCipher.final(),
      deviceCipher.getAuthTag(),
    ]);

    // Optional server-side encryption for device
    let deviceServerWrapped: string | null = null;
    let deviceServerIv: string | null = null;

    try {
      const wrapped = await serverEncryption.wrapData(encryptedForDevice);
      deviceServerWrapped = wrapped.wrapped;
      deviceServerIv = wrapped.iv;
    } catch (error) {
      console.log('[SetupEncryption] Server-side encryption not available for device');
    }

    // Store device registration
    await userDB.exec`
      INSERT INTO subscription_devices (
        subscription_id,
        device_id,
        device_type,
        device_name,
        device_model,
        kdf_iterations,
        master_key_wrapped,
        salt,
        iv,
        server_wrapped_key,
        server_iv
      ) VALUES (
        ${accountId},
        ${deviceId},
        ${deviceType},
        ${deviceName || null},
        ${deviceModel || null},
        ${deviceIterations},
        ${encryptedForDevice.toString('base64')},
        ${deviceSalt.toString('base64')},
        ${deviceIv.toString('base64')},
        ${deviceServerWrapped},
        ${deviceServerIv}
      )
    `;

    console.log('[SetupEncryption] Device registered successfully');
    return { success: true };
  }
);