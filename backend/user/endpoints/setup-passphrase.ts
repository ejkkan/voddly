import { api, APIError } from 'encore.dev/api';
import { getAuthData } from '~encore/auth';
import * as crypto from 'crypto';
import { userDB } from '../db';
import { getServerEncryption } from '../lib/encryption-service';

interface SetupPassphraseRequest {
  passphrase: string;
  deviceId: string;
  deviceType: 'ios' | 'tvos' | 'android' | 'web';
  deviceName?: string;
  deviceModel?: string;
}

// One-time passphrase setup - only works if account has no encryption yet
export const setupPassphrase = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/account/setup-passphrase',
  },
  async (req: SetupPassphraseRequest): Promise<{ success: boolean }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get user's account
    const account = await userDB.queryRow<{ id: string }>`
      SELECT id FROM user_subscription WHERE user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('No account found');
    }

    // Check if encryption already exists (one-time only)
    const existingEncryption = await userDB.queryRow<{ subscription_id: string }>`
      SELECT subscription_id FROM subscription_encryption WHERE subscription_id = ${account.id}
    `;

    if (existingEncryption) {
      throw APIError.alreadyExists('Passphrase has already been set up for this account');
    }

    // Validate passphrase
    if (!req.passphrase || req.passphrase.length !== 6 || !/^\d{6}$/.test(req.passphrase)) {
      throw APIError.invalidArgument('Passphrase must be exactly 6 digits');
    }

    console.log('[SetupPassphrase] Setting up encryption for account:', account.id);

    // Generate account master key
    const masterKey = crypto.randomBytes(32);

    // Derive key from passphrase
    const salt = crypto.randomBytes(16);
    const KDF_ITERATIONS = 100000;
    const derivedKey = crypto.pbkdf2Sync(
      req.passphrase,
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
        ${account.id}, 
        ${userWrapped.toString('base64')},
        ${server_wrapped},
        ${server_iv},
        ${salt.toString('base64')},
        ${iv.toString('base64')},
        ${KDF_ITERATIONS}
      )
    `;

    console.log('[SetupPassphrase] Encryption initialized');

    // Register device
    const deviceIterations = req.deviceType === 'tvos' ? 100000 :
                             req.deviceType === 'android' ? 300000 :
                             req.deviceType === 'ios' ? 500000 : 500000;

    const deviceSalt = crypto.randomBytes(16);
    const deviceIv = crypto.randomBytes(12);

    // Derive device-specific key
    const deviceDerivedKey = crypto.pbkdf2Sync(
      req.passphrase,
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
      console.log('[SetupPassphrase] Server-side encryption not available for device');
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
        ${account.id},
        ${req.deviceId},
        ${req.deviceType},
        ${req.deviceName || null},
        ${req.deviceModel || null},
        ${deviceIterations},
        ${encryptedForDevice.toString('base64')},
        ${deviceSalt.toString('base64')},
        ${deviceIv.toString('base64')},
        ${deviceServerWrapped},
        ${deviceServerIv}
      )
    `;

    console.log('[SetupPassphrase] Device registered successfully');
    return { success: true };
  }
);