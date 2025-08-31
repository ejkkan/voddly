import { api, APIError } from 'encore.dev/api';
import * as crypto from 'crypto';
import { userDB } from '../db';
import { getServerEncryption } from '../lib/encryption-service';
import {
  validateDevice,
  autoRegisterDevice,
  getAccountDevices,
} from '../lib/device-validation';

interface RegisterDeviceRequest {
  accountId: string; // UUID as string
  deviceId: string;
  deviceType: 'ios' | 'tvos' | 'android' | 'web';
  deviceName?: string;
  deviceModel?: string;
  passphrase: string;
}

// Map client device types to database device types
function mapDeviceType(clientDeviceType: string): string {
  switch (clientDeviceType) {
    case 'ios':
    case 'android':
      return 'mobile';
    case 'tvos':
      return 'tv';
    case 'web':
      return 'web';
    default:
      return 'mobile'; // Default fallback
  }
}

interface RegisterDeviceResponse {
  success: boolean;
  deviceId: string;
  iterations: number;
  keyData: {
    master_key_wrapped: string;
    salt: string;
    iv: string;
    kdf_iterations: number;
    server_wrapped_key?: string;
    server_iv?: string;
  };
}

interface GetDeviceKeyRequest {
  accountId: string; // UUID as string
  deviceId: string;
}

interface GetDeviceKeyResponse {
  keyData: {
    master_key_wrapped: string;
    salt: string;
    iv: string;
    kdf_iterations: number;
    server_wrapped_key?: string;
    server_iv?: string;
  };
}

/**
 * Get optimal iteration count based on device type
 */
function getOptimalIterations(deviceType: string): number {
  switch (deviceType) {
    case 'tvos':
      return 100000; // 100k for tvOS (JavaScript only)
    case 'android':
      return 300000; // 300k for Android (varies by device)
    case 'ios':
      return 500000; // 500k for iOS (with native crypto)
    case 'web':
      return 500000; // 500k for web (fast enough)
    default:
      return 200000; // Conservative default
  }
}

/**
 * Register a new device with device-specific encryption settings
 */
export const registerDevice = api<
  RegisterDeviceRequest,
  RegisterDeviceResponse
>(
  { method: 'POST', path: '/user/register-device', expose: true },
  async (req) => {
    const {
      accountId,
      deviceId,
      deviceType,
      deviceName,
      deviceModel,
      passphrase,
    } = req;

    console.log(
      `[DeviceAuth] Registering device ${deviceId} for account ${accountId}`
    );

    // Check if device already exists
    const existing = await userDB.queryRow<{
      id: number;
      master_key_wrapped: string;
      salt: string;
      iv: string;
      kdf_iterations: number;
      server_wrapped_key: string | null;
      server_iv: string | null;
    }>`
      SELECT 
        id,
        master_key_wrapped,
        salt,
        iv,
        kdf_iterations,
        server_wrapped_key,
        server_iv
      FROM subscription_devices 
      WHERE subscription_id = ${accountId} AND device_id = ${deviceId}
    `;

    if (existing) {
      console.log(
        `[DeviceAuth] Device ${deviceId} already registered, validating passphrase...`
      );

      // Validate that the passphrase matches before returning the key
      // This prevents someone from getting the device key with a wrong passphrase
      const accountEncryption = await userDB.queryRow<{
        master_key_wrapped: string;
        salt: string;
        iv: string;
        kdf_iterations: number;
      }>`
        SELECT master_key_wrapped, salt, iv, kdf_iterations
        FROM subscription_encryption
        WHERE subscription_id = ${accountId}
      `;

      if (!accountEncryption) {
        throw new Error('Account encryption not found');
      }

      // Try to decrypt with provided passphrase to validate it
      const originalSalt = Buffer.from(accountEncryption.salt, 'base64');
      const originalDerivedKey = crypto.pbkdf2Sync(
        passphrase,
        originalSalt,
        accountEncryption.kdf_iterations,
        32,
        'sha256'
      );

      const wrappedKey = Buffer.from(
        accountEncryption.master_key_wrapped,
        'base64'
      );
      const authTag = wrappedKey.slice(-16);
      const ciphertext = wrappedKey.slice(0, -16);
      const originalIv = Buffer.from(accountEncryption.iv, 'base64');

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        originalDerivedKey,
        originalIv
      );
      decipher.setAuthTag(authTag);

      try {
        decipher.update(ciphertext);
        decipher.final();
      } catch (error) {
        console.error(
          '[DeviceAuth] Passphrase validation failed for existing device'
        );
        throw new Error('Invalid passphrase');
      }

      // Passphrase is valid, update last_used and return existing device data
      await userDB.exec`
        UPDATE subscription_devices 
        SET last_used = CURRENT_TIMESTAMP
        WHERE subscription_id = ${accountId} AND device_id = ${deviceId}
      `;

      // Ensure we return device-layer ciphertext. If server layer exists, unwrap it.
      const serverEncryption = getServerEncryption();
      let masterWrappedToReturn = existing.master_key_wrapped;
      if (existing.server_wrapped_key && existing.server_iv) {
        const unwrapped = await serverEncryption.serverUnwrap(
          existing.server_wrapped_key,
          existing.server_iv
        );
        masterWrappedToReturn = unwrapped.toString('base64');
      }

      return {
        success: true,
        deviceId,
        iterations: existing.kdf_iterations,
        keyData: {
          master_key_wrapped: masterWrappedToReturn,
          salt: existing.salt,
          iv: existing.iv,
          kdf_iterations: existing.kdf_iterations,
          server_wrapped_key: existing.server_wrapped_key || undefined,
          server_iv: existing.server_iv || undefined,
        },
      };
    }

    // Get the account's master encryption data
    const accountEncryption = await userDB.queryRow<{
      master_key_wrapped: string;
      salt: string;
      iv: string;
      kdf_iterations: number;
    }>`
      SELECT master_key_wrapped, salt, iv, kdf_iterations
      FROM subscription_encryption
      WHERE subscription_id = ${accountId}
    `;

    if (!accountEncryption) {
      throw new Error('Account encryption not found');
    }

    // Derive the user's key with original iterations to decrypt master key
    const originalSalt = Buffer.from(accountEncryption.salt, 'base64');
    const originalIv = Buffer.from(accountEncryption.iv, 'base64');

    console.log(
      `[DeviceAuth] Deriving key with original ${accountEncryption.kdf_iterations} iterations`
    );
    const originalDerivedKey = crypto.pbkdf2Sync(
      passphrase,
      originalSalt,
      accountEncryption.kdf_iterations,
      32,
      'sha256'
    );

    // Decrypt the master key
    const wrappedKey = Buffer.from(
      accountEncryption.master_key_wrapped,
      'base64'
    );
    const authTag = wrappedKey.slice(-16);
    const ciphertext = wrappedKey.slice(0, -16);

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      originalDerivedKey,
      originalIv
    );
    decipher.setAuthTag(authTag);

    let masterKey: Buffer;
    try {
      masterKey = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
    } catch (error) {
      console.error(
        '[DeviceAuth] Failed to decrypt master key - invalid passphrase'
      );
      throw new Error('Invalid passphrase');
    }

    // Now create device-specific encryption with optimal iterations
    const deviceIterations = getOptimalIterations(deviceType);
    const deviceSalt = crypto.randomBytes(16);
    const deviceIv = crypto.randomBytes(12);

    console.log(
      `[DeviceAuth] Creating device-specific encryption with ${deviceIterations} iterations`
    );
    const deviceDerivedKey = crypto.pbkdf2Sync(
      passphrase,
      deviceSalt,
      deviceIterations,
      32,
      'sha256'
    );

    // Encrypt master key with device-specific key
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      deviceDerivedKey,
      deviceIv
    );
    const encryptedMasterKey = Buffer.concat([
      cipher.update(masterKey),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    // Optional: Add server-side encryption layer
    let serverWrappedKey: string | null = null;
    let serverIv: string | null = null;

    try {
      const serverEncryption = getServerEncryption();
      const wrapped = await serverEncryption.wrapData(encryptedMasterKey);
      serverWrappedKey = wrapped.wrapped;
      serverIv = wrapped.iv;
      console.log('[DeviceAuth] Added server-side encryption layer');
    } catch (error) {
      console.log(
        '[DeviceAuth] Server-side encryption not available, using single layer'
      );
    }

    // Map device type to database-compatible value
    const dbDeviceType = mapDeviceType(deviceType);

    // Store device-specific encryption
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
        ${dbDeviceType},
        ${deviceName || null},
        ${deviceModel || null},
        ${deviceIterations},
        ${encryptedMasterKey.toString('base64')},
        ${deviceSalt.toString('base64')},
        ${deviceIv.toString('base64')},
        ${serverWrappedKey},
        ${serverIv}
      )
      ON CONFLICT (subscription_id, device_id) DO UPDATE SET
        is_active = true,
        device_type = EXCLUDED.device_type,
        device_name = EXCLUDED.device_name,
        device_model = EXCLUDED.device_model,
        kdf_iterations = EXCLUDED.kdf_iterations,
        master_key_wrapped = EXCLUDED.master_key_wrapped,
        salt = EXCLUDED.salt,
        iv = EXCLUDED.iv,
        server_wrapped_key = EXCLUDED.server_wrapped_key,
        server_iv = EXCLUDED.server_iv,
        last_used = CURRENT_TIMESTAMP
    `;

    console.log(
      `[DeviceAuth] Device ${deviceId} registered successfully with ${deviceIterations} iterations`
    );

    return {
      success: true,
      deviceId,
      iterations: deviceIterations,
      keyData: {
        master_key_wrapped:
          serverWrappedKey || encryptedMasterKey.toString('base64'),
        salt: deviceSalt.toString('base64'),
        iv: deviceIv.toString('base64'),
        kdf_iterations: deviceIterations,
        server_wrapped_key: serverWrappedKey || undefined,
        server_iv: serverIv || undefined,
      },
    };
  }
);

/**
 * Get device-specific key data
 */
export const getDeviceKey = api<GetDeviceKeyRequest, GetDeviceKeyResponse>(
  { method: 'POST', path: '/user/get-device-key', expose: true },
  async (req) => {
    const { accountId, deviceId } = req;

    const deviceData = await userDB.queryRow<{
      master_key_wrapped: string;
      salt: string;
      iv: string;
      kdf_iterations: number;
      server_wrapped_key: string | null;
      server_iv: string | null;
    }>`
      SELECT 
        master_key_wrapped,
        salt,
        iv,
        kdf_iterations,
        server_wrapped_key,
        server_iv
      FROM subscription_devices
      WHERE subscription_id = ${accountId} AND device_id = ${deviceId}
    `;

    if (!deviceData) {
      throw new Error('Device not registered');
    }

    // Update last used and mark as active
    await userDB.exec`
      UPDATE subscription_devices 
      SET 
        last_used = CURRENT_TIMESTAMP,
        is_active = true
      WHERE subscription_id = ${accountId} AND device_id = ${deviceId}
    `;

    // If server layer exists, unwrap so we return device-layer ciphertext
    let masterWrappedToReturn = deviceData.master_key_wrapped;
    if (deviceData.server_wrapped_key && deviceData.server_iv) {
      const serverEncryption = getServerEncryption();
      const unwrapped = await serverEncryption.serverUnwrap(
        deviceData.server_wrapped_key,
        deviceData.server_iv
      );
      masterWrappedToReturn = unwrapped.toString('base64');
    }

    return {
      keyData: {
        master_key_wrapped: masterWrappedToReturn,
        salt: deviceData.salt,
        iv: deviceData.iv,
        kdf_iterations: deviceData.kdf_iterations,
        server_wrapped_key: deviceData.server_wrapped_key || undefined,
        server_iv: deviceData.server_iv || undefined,
      },
    };
  }
);

/**
 * List all registered devices for an account with management info
 */
export const listDevices = api<
  { accountId: string /* UUID */ },
  {
    devices: any[];
    activeCount: number;
    maxDevices: number;
    hasAvailableSlots: boolean;
  }
>(
  { method: 'GET', path: '/user/list-devices/:accountId', expose: true },
  async (req) => {
    const result = await getAccountDevices(req.accountId);
    return result;
  }
);

/**
 * Remove/deactivate a device
 */
export const removeDevice = api<
  { accountId: string; deviceId: string },
  { success: boolean }
>(
  { method: 'POST', path: '/user/remove-device', expose: true },
  async (req) => {
    const { accountId, deviceId } = req;

    console.log(
      `[RemoveDevice] Deactivating device ${deviceId} for account ${accountId}`
    );

    await userDB.exec`
    UPDATE subscription_devices 
    SET 
      is_active = false,
      deactivated_at = CURRENT_TIMESTAMP
    WHERE subscription_id = ${accountId} 
      AND device_id = ${deviceId}
  `;

    return { success: true };
  }
);

/**
 * Check if a device is registered for an account
 */
export const checkDevice = api<
  { accountId: string; deviceId: string },
  {
    isRegistered: boolean;
    requiresPassphrase: boolean;
    canAutoRegister?: boolean;
    deviceCount?: number;
    maxDevices?: number;
    message?: string;
  }
>({ method: 'POST', path: '/user/check-device', expose: true }, async (req) => {
  const { accountId, deviceId } = req;

  console.log(
    `[CheckDevice] Validating device ${deviceId} for account ${accountId}`
  );

  // Use comprehensive device validation
  const validation = await validateDevice(accountId, deviceId);

  console.log(`[CheckDevice] Validation result:`, validation);

  if (validation.isValid) {
    // Device is active and valid
    return {
      isRegistered: true,
      requiresPassphrase: false,
      canAutoRegister: false,
      deviceCount: validation.deviceCount,
      maxDevices: validation.maxDevices,
    };
  }

  // Check if account has encryption
  const hasEncryption = await userDB.queryRow<{ subscription_id: string }>`
      SELECT subscription_id FROM subscription_encryption WHERE subscription_id = ${accountId}
    `;

  console.log(
    `[CheckDevice] Account ${accountId} has encryption: ${!!hasEncryption}`
  );

  return {
    isRegistered: false,
    requiresPassphrase: !!hasEncryption && validation.canAutoRegister,
    canAutoRegister: validation.canAutoRegister,
    deviceCount: validation.deviceCount,
    maxDevices: validation.maxDevices,
    message: validation.message,
  };
});
