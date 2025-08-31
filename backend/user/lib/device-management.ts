import { APIError } from 'encore.dev/api';
import { userDB } from '../db';
import log from 'encore.dev/log';

interface DeviceStatus {
  exists: boolean;
  isActive: boolean;
  canRegister: boolean;
  deviceCount: number;
  maxDevices: number;
  message?: string;
}

// Default device slots if not set on account
const DEFAULT_DEVICE_SLOTS = 3;

// Time in minutes before a device is considered inactive
const INACTIVE_THRESHOLD_MINUTES = 10;

/**
 * Check device status and update activity
 */
export async function checkDeviceStatus(
  accountId: string,
  deviceId: string
): Promise<DeviceStatus> {
  // Check if device exists and has encryption data
  const device = await userDB.queryRow<{
    id: number;
    is_active: boolean;
    last_used: Date;
    master_key_wrapped: string | null;
    salt: string | null;
  }>`
    SELECT id, is_active, last_used, master_key_wrapped, salt
    FROM subscription_devices 
    WHERE subscription_id = ${accountId} 
      AND device_id = ${deviceId}
  `;

  if (device) {
    // Check if device has encryption data (was properly registered with passphrase)
    if (device.master_key_wrapped && device.salt) {
      // Device exists with valid encryption - update last_used and set active
      await userDB.exec`
        UPDATE subscription_devices 
        SET 
          last_used = CURRENT_TIMESTAMP,
          is_active = true
        WHERE subscription_id = ${accountId} 
          AND device_id = ${deviceId}
      `;

      log.info('[DeviceManagement] Device marked as active', { deviceId });

      return {
        exists: true,
        isActive: true,
        canRegister: false,
        deviceCount: 0,
        maxDevices: 0,
      };
    } else {
      // Device record exists but no encryption data - needs re-registration
      log.info('[DeviceManagement] Device exists but needs passphrase registration', { deviceId });

      // Delete the incomplete device record
      await userDB.exec`
        DELETE FROM subscription_devices 
        WHERE subscription_id = ${accountId} 
          AND device_id = ${deviceId}
      `;
    }
  }

  // Device doesn't exist, check if we can register it
  const account = await userDB.queryRow<{
    device_slots: number;
  }>`
    SELECT device_slots 
    FROM user_subscription 
    WHERE id = ${accountId}
  `;

  if (!account) {
    throw APIError.notFound('Account not found');
  }

  // Count total devices (all count toward limit, active or not)
  const deviceCountResult = await userDB.queryRow<{ count: number }>`
    SELECT COUNT(*) as count 
    FROM subscription_devices 
    WHERE subscription_id = ${accountId}
  `;

  const deviceCount = deviceCountResult?.count || 0;
  const maxDevices = account.device_slots || DEFAULT_DEVICE_SLOTS;

  if (deviceCount < maxDevices) {
    return {
      exists: false,
      isActive: false,
      canRegister: true,
      deviceCount,
      maxDevices,
      message: 'Device can be registered',
    };
  }

  return {
    exists: false,
    isActive: false,
    canRegister: false,
    deviceCount,
    maxDevices,
    message: 'Device limit exceeded',
  };
}

/**
 * Update device activity status on API calls
 */
export async function updateDeviceActivity(
  accountId: string,
  deviceId: string
): Promise<void> {
  await userDB.exec`
    UPDATE subscription_devices 
    SET 
      last_used = CURRENT_TIMESTAMP,
      is_active = true
    WHERE subscription_id = ${accountId} 
      AND device_id = ${deviceId}
  `;
}

/**
 * Mark devices as inactive if not used recently
 * This should be called periodically (e.g., by a cron job)
 */
export async function markInactiveDevices(): Promise<number> {
  const result = await userDB.exec`
    UPDATE subscription_devices 
    SET is_active = false
    WHERE is_active = true
      AND last_used < NOW() - INTERVAL '${INACTIVE_THRESHOLD_MINUTES} minutes'
  `;

  const rowsAffected = (result as any).rowCount || 0;

  if (rowsAffected > 0) {
    log.info('[DeviceManagement] Marked devices as inactive', { count: rowsAffected });
  }

  return rowsAffected;
}

/**
 * Remove a device completely (hard delete)
 */
export async function removeDevice(
  accountId: string,
  deviceId: string
): Promise<void> {
  await userDB.exec`
    DELETE FROM subscription_devices 
    WHERE subscription_id = ${accountId} 
      AND device_id = ${deviceId}
  `;

  log.info('[DeviceManagement] Device removed', { deviceId, accountId });
}

/**
 * Get all devices for an account with their online status
 */
export async function getAccountDevices(accountId: string) {
  // First, update inactive status for old devices
  await userDB.exec`
    UPDATE subscription_devices 
    SET is_active = false
    WHERE subscription_id = ${accountId}
      AND is_active = true
      AND last_used < NOW() - INTERVAL '${INACTIVE_THRESHOLD_MINUTES} minutes'
  `;

  const devices = await userDB.query<{
    device_id: string;
    device_type: string;
    device_name: string | null;
    device_model: string | null;
    is_active: boolean;
    last_used: Date;
    created_at: Date;
  }>`
    SELECT 
      device_id,
      device_type,
      device_name,
      device_model,
      is_active,
      last_used,
      created_at
    FROM subscription_devices
    WHERE subscription_id = ${accountId}
    ORDER BY is_active DESC, last_used DESC
  `;

  const deviceList = [];
  for await (const device of devices) {
    deviceList.push({
      ...device,
      status: device.is_active ? 'online' : 'offline',
    });
  }

  const account = await userDB.queryRow<{
    device_slots: number;
  }>`
    SELECT device_slots 
    FROM user_subscription 
    WHERE id = ${accountId}
  `;

  const maxDevices = account?.device_slots || DEFAULT_DEVICE_SLOTS;
  const totalCount = deviceList.length;
  const activeCount = deviceList.filter((d) => d.is_active).length;

  return {
    devices: deviceList,
    totalCount,
    activeCount,
    maxDevices,
    hasAvailableSlots: totalCount < maxDevices,
  };
}

/**
 * Validate if a device is registered and update its activity
 * Used for protecting sensitive operations
 */
export async function validateAndActivateDevice(
  accountId: string,
  deviceId: string
): Promise<boolean> {
  const device = await userDB.queryRow<{ id: number }>`
    SELECT id 
    FROM subscription_devices 
    WHERE subscription_id = ${accountId} 
      AND device_id = ${deviceId}
  `;
  log.info('validateAndActivateDevice Device', device);
  if (!device) {
    return false;
  }

  // Update activity
  await updateDeviceActivity(accountId, deviceId);
  return true;
}
