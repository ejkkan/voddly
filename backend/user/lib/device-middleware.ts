import { APIError, Header } from 'encore.dev/api';
import { validateAndActivateDevice } from './device-management';

/**
 * Middleware to validate device on sensitive operations
 * Extracts device ID from headers and validates it exists
 */
export async function requireValidDevice(
  accountId: string,
  deviceIdHeader?: Header<'X-Device-Id'>
): Promise<void> {
  if (!deviceIdHeader) {
    console.warn('[DeviceMiddleware] No device ID header provided');
    // For backward compatibility, we'll allow requests without device ID for now
    // In production, you might want to throw an error here
    return;
  }

  const deviceId = deviceIdHeader;
  
  const isValid = await validateAndActivateDevice(accountId, deviceId);
  
  if (!isValid) {
    console.error(`[DeviceMiddleware] Invalid device ${deviceId} for account ${accountId}`);
    throw APIError.forbidden('Device not registered or has been removed');
  }
  
  console.log(`[DeviceMiddleware] Device ${deviceId} validated and activated`);
}