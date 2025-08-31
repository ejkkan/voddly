import { getDeviceId, getDeviceInfo } from './device-id';

/**
 * Debug function to log device ID information
 */
export function debugDeviceId() {
  try {
    const deviceId = getDeviceId();
    const deviceInfo = getDeviceInfo();

    console.log('[DEBUG DEVICE] Device ID:', deviceId);
    console.log(
      '[DEBUG DEVICE] Device Info:',
      JSON.stringify(deviceInfo, null, 2)
    );

    return { deviceId, deviceInfo };
  } catch (error) {
    console.error('[DEBUG DEVICE] Error getting device ID:', error);
    return null;
  }
}
