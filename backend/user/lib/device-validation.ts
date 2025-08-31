import { APIError } from 'encore.dev/api';
import { userDB } from '../db';

interface DeviceValidationResult {
  isValid: boolean;
  deviceExists: boolean;
  canAutoRegister: boolean;
  deviceCount: number;
  maxDevices: number;
  message?: string;
}

// Device limits per subscription tier
const DEVICE_LIMITS = {
  basic: 3,
  standard: 5,
  premium: 10,
};

/**
 * Validate if a device is authorized to access the account
 * This should be called on sensitive operations
 */
export async function validateDevice(
  accountId: string,
  deviceId: string
): Promise<DeviceValidationResult> {
  // Check if device exists and is active
  const device = await userDB.queryRow<{
    id: number;
    is_active: boolean;
    last_used: Date;
  }>`
    SELECT id, is_active, last_used 
    FROM subscription_devices 
    WHERE subscription_id = ${accountId} 
      AND device_id = ${deviceId}
      AND is_active = true
  `;

  if (device) {
    // Update last used timestamp
    await userDB.exec`
      UPDATE subscription_devices 
      SET last_used = CURRENT_TIMESTAMP
      WHERE subscription_id = ${accountId} AND device_id = ${deviceId}
    `;

    return {
      isValid: true,
      deviceExists: true,
      canAutoRegister: false,
      deviceCount: 0,
      maxDevices: 0,
    };
  }

  // Device doesn't exist or is inactive, check if we can auto-register
  const account = await userDB.queryRow<{
    subscription_tier: string;
  }>`
    SELECT subscription_tier 
    FROM user_subscription 
    WHERE id = ${accountId}
  `;

  if (!account) {
    throw APIError.notFound('Account not found');
  }

  // Count active devices
  const deviceCountResult = await userDB.queryRow<{ count: number }>`
    SELECT COUNT(*) as count 
    FROM subscription_devices 
    WHERE subscription_id = ${accountId} 
      AND is_active = true
  `;

  const deviceCount = deviceCountResult?.count || 0;
  const maxDevices = DEVICE_LIMITS[account.subscription_tier as keyof typeof DEVICE_LIMITS] || DEVICE_LIMITS.basic;

  // Check if device was previously registered but deactivated
  const previousDevice = await userDB.queryRow<{ id: number }>`
    SELECT id 
    FROM subscription_devices 
    WHERE subscription_id = ${accountId} 
      AND device_id = ${deviceId}
      AND is_active = false
  `;

  if (previousDevice) {
    // Device was removed/deactivated
    if (deviceCount < maxDevices) {
      // Can reactivate if under limit
      return {
        isValid: false,
        deviceExists: false,
        canAutoRegister: true,
        deviceCount,
        maxDevices,
        message: 'Device was removed but can be re-registered',
      };
    } else {
      // Over device limit
      return {
        isValid: false,
        deviceExists: false,
        canAutoRegister: false,
        deviceCount,
        maxDevices,
        message: 'Device limit exceeded',
      };
    }
  }

  // New device
  if (deviceCount < maxDevices) {
    return {
      isValid: false,
      deviceExists: false,
      canAutoRegister: true,
      deviceCount,
      maxDevices,
      message: 'New device can be registered',
    };
  }

  return {
    isValid: false,
    deviceExists: false,
    canAutoRegister: false,
    deviceCount,
    maxDevices,
    message: 'Device limit exceeded',
  };
}

/**
 * Auto-register or reactivate a device if possible
 */
export async function autoRegisterDevice(
  accountId: string,
  deviceId: string,
  deviceInfo: {
    deviceType: string;
    deviceName?: string;
    deviceModel?: string;
  }
): Promise<boolean> {
  const validation = await validateDevice(accountId, deviceId);

  if (!validation.canAutoRegister) {
    return false;
  }

  // Check if device exists but is inactive
  const existingDevice = await userDB.queryRow<{ id: number }>`
    SELECT id 
    FROM subscription_devices 
    WHERE subscription_id = ${accountId} 
      AND device_id = ${deviceId}
  `;

  if (existingDevice) {
    // Reactivate existing device
    await userDB.exec`
      UPDATE subscription_devices 
      SET 
        is_active = true,
        last_used = CURRENT_TIMESTAMP,
        device_type = ${deviceInfo.deviceType},
        device_name = ${deviceInfo.deviceName || null},
        device_model = ${deviceInfo.deviceModel || null}
      WHERE subscription_id = ${accountId} 
        AND device_id = ${deviceId}
    `;
    
    console.log(`[DeviceValidation] Reactivated device ${deviceId} for account ${accountId}`);
    return true;
  }

  // This would be a new device registration without passphrase
  // We should NOT auto-register new devices without passphrase verification
  // Only reactivation is allowed
  return false;
}

/**
 * Deactivate a device
 */
export async function deactivateDevice(
  accountId: string,
  deviceId: string
): Promise<void> {
  await userDB.exec`
    UPDATE subscription_devices 
    SET 
      is_active = false,
      deactivated_at = CURRENT_TIMESTAMP
    WHERE subscription_id = ${accountId} 
      AND device_id = ${deviceId}
  `;
}

/**
 * Get all devices for an account with their status
 */
export async function getAccountDevices(accountId: string) {
  const devices = await userDB.query<{
    device_id: string;
    device_type: string;
    device_name: string | null;
    device_model: string | null;
    is_active: boolean;
    last_used: Date;
    created_at: Date;
    deactivated_at: Date | null;
  }>`
    SELECT 
      device_id,
      device_type,
      device_name,
      device_model,
      is_active,
      last_used,
      created_at,
      deactivated_at
    FROM subscription_devices
    WHERE subscription_id = ${accountId}
    ORDER BY last_used DESC
  `;

  const deviceList = [];
  for await (const device of devices) {
    deviceList.push(device);
  }

  const account = await userDB.queryRow<{
    subscription_tier: string;
  }>`
    SELECT subscription_tier 
    FROM user_subscription 
    WHERE id = ${accountId}
  `;

  const maxDevices = DEVICE_LIMITS[account?.subscription_tier as keyof typeof DEVICE_LIMITS] || DEVICE_LIMITS.basic;
  const activeCount = deviceList.filter(d => d.is_active).length;

  return {
    devices: deviceList,
    activeCount,
    maxDevices,
    hasAvailableSlots: activeCount < maxDevices,
  };
}