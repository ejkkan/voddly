'use client';

/**
 * Device ID management for tvOS
 * Generates and persists a unique device identifier
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'tvos_device_id';

/**
 * Generate a unique device ID for tvOS that persists across app launches
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Try to get existing device ID
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    
    if (!deviceId) {
      // Generate new device ID
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      deviceId = `tvos-${timestamp}-${random}`;
      
      // Store for future use
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      console.log('[DeviceID] Generated new device ID:', deviceId);
    } else {
      console.log('[DeviceID] Using existing device ID:', deviceId);
    }
    
    return deviceId;
  } catch (error) {
    console.error('[DeviceID] Error managing device ID:', error);
    
    // Fallback to session-based ID
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `tvos-session-${timestamp}-${random}`;
  }
}

/**
 * Clear stored device ID (for testing or reset)
 */
export async function clearDeviceId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEVICE_ID_KEY);
    console.log('[DeviceID] Device ID cleared');
  } catch (error) {
    console.error('[DeviceID] Error clearing device ID:', error);
  }
}