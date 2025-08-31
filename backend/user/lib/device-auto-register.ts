import { APIError } from 'encore.dev/api';
import log from 'encore.dev/log';
import { userDB } from '../db';
import crypto from 'crypto';
import { promisify } from 'util';

const pbkdf2 = promisify(crypto.pbkdf2);

// Platform to device type mapping
const getDeviceType = (deviceId: string): string => {
  if (deviceId.startsWith('ios_')) return 'ios';
  if (deviceId.startsWith('android_')) return 'android';
  if (deviceId.startsWith('web_')) return 'web';
  return 'unknown';
};

// Get device name from ID
const getDeviceName = (deviceId: string): string => {
  const type = getDeviceType(deviceId);
  return `${type.charAt(0).toUpperCase() + type.slice(1)} Device`;
};

/**
 * Auto-register a device when passphrase is provided
 */
export async function autoRegisterDevice(
  accountId: string,
  deviceId: string,
  passphrase: string
): Promise<boolean> {
  try {
    log.info('[DeviceAutoRegister] Starting auto-registration', { accountId, deviceId });
    
    // Get account encryption details
    const account = await userDB.queryRow<{
      master_key_salt: string;
      master_key_hash: string;
      kdf_iterations: number;
    }>`
      SELECT master_key_salt, master_key_hash, kdf_iterations
      FROM user_subscription 
      WHERE id = ${accountId}
    `;
    
    if (!account) {
      log.error('[DeviceAutoRegister] Account not found', { accountId });
      return false;
    }
    
    if (!account.master_key_salt || !account.master_key_hash) {
      log.warn('[DeviceAutoRegister] Account has no encryption setup', { accountId });
      return false;
    }
    
    // Verify passphrase by deriving master key and comparing hash
    const masterKeySalt = Buffer.from(account.master_key_salt, 'base64');
    const iterations = account.kdf_iterations || 100000;
    
    const derivedKey = await pbkdf2(passphrase, masterKeySalt, iterations, 32, 'sha256');
    const derivedKeyHash = crypto.createHash('sha256').update(derivedKey).digest('base64');
    
    if (derivedKeyHash !== account.master_key_hash) {
      log.error('[DeviceAutoRegister] Invalid passphrase provided', { accountId, deviceId });
      return false;
    }
    
    // Generate device-specific encryption parameters
    const deviceSalt = crypto.randomBytes(16);
    const deviceIterations = 50000 + Math.floor(Math.random() * 50000); // 50k-100k
    
    // Derive device-specific key from master key
    const deviceKey = await pbkdf2(
      derivedKey,
      deviceSalt,
      deviceIterations,
      32,
      'sha256'
    );
    
    // Create wrapped master key for this device
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      deviceKey,
      crypto.randomBytes(16)
    );
    const encrypted = Buffer.concat([
      cipher.update(derivedKey),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    
    const wrappedMasterKey = Buffer.concat([
      encrypted,
      authTag
    ]).toString('base64');
    
    // Get device info
    const deviceType = getDeviceType(deviceId);
    const deviceName = getDeviceName(deviceId);
    
    // Insert device record
    await userDB.exec`
      INSERT INTO subscription_devices (
        subscription_id,
        device_id,
        device_type,
        device_name,
        master_key_wrapped,
        salt,
        iterations,
        is_active,
        last_used
      ) VALUES (
        ${accountId},
        ${deviceId},
        ${deviceType},
        ${deviceName},
        ${wrappedMasterKey},
        ${deviceSalt.toString('base64')},
        ${deviceIterations},
        true,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (subscription_id, device_id) 
      DO UPDATE SET
        master_key_wrapped = EXCLUDED.master_key_wrapped,
        salt = EXCLUDED.salt,
        iterations = EXCLUDED.iterations,
        is_active = true,
        last_used = CURRENT_TIMESTAMP
    `;
    
    log.info('[DeviceAutoRegister] Device successfully registered', { 
      accountId, 
      deviceId, 
      deviceType 
    });
    
    return true;
  } catch (error) {
    log.error('[DeviceAutoRegister] Registration failed', { 
      error, 
      accountId, 
      deviceId 
    });
    return false;
  }
}