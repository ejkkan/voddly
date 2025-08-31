'use client';

import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';

import { apiClient } from '@/lib/api-client';
import {
  getDeviceId,
  getDeviceType,
  getOptimalIterations,
} from '@/lib/crypto-unified';

const storage = new MMKV();

interface DeviceKeyData {
  master_key_wrapped: string;
  salt: string;
  iv: string;
  kdf_iterations: number;
  server_wrapped_key?: string;
  server_iv?: string;
}

interface DeviceInfo {
  deviceId: string;
  deviceType: 'ios' | 'tvos' | 'android' | 'web';
  deviceName?: string;
  deviceModel?: string;
}

/**
 * Manages device registration and device-specific encryption
 */
export class DeviceManager {
  private static instance: DeviceManager;

  private constructor() {}

  static getInstance(): DeviceManager {
    if (!this.instance) {
      this.instance = new DeviceManager();
    }
    return this.instance;
  }

  /**
   * Get device info for the current device
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    const deviceId = await getDeviceId();
    const deviceType = getDeviceType();

    // Get device model/name if available
    let deviceName: string | undefined;
    let deviceModel: string | undefined;

    try {
      if (Platform.OS !== 'web') {
        const Device = await import('expo-device');
        deviceModel = Device.modelName || undefined;
        deviceName = Device.deviceName || `${Device.osName} Device`;
      } else {
        deviceName = 'Web Browser';
        deviceModel = navigator.userAgent.substring(0, 100);
      }
    } catch (error) {
      console.log('[DeviceManager] Could not get device info:', error);
    }

    return {
      deviceId,
      deviceType,
      deviceName,
      deviceModel,
    };
  }

  /**
   * Check if device is registered for an account
   */
  async isDeviceRegistered(accountId: string): Promise<boolean> {
    const cacheKey = `device_registered_${accountId}`;
    return storage.getBoolean(cacheKey) || false;
  }

  /**
   * Register device with optimal encryption settings
   */
  async registerDevice(
    accountId: string,
    passphrase: string,
    onProgress?: (message: string) => void
  ): Promise<DeviceKeyData> {
    const deviceInfo = await this.getDeviceInfo();

    onProgress?.(`Registering ${deviceInfo.deviceType} device...`);

    try {
      // Call the registration endpoint
      const response = await apiClient.user.registerDevice({
        accountId,
        deviceId: deviceInfo.deviceId,
        deviceType: deviceInfo.deviceType,
        deviceName: deviceInfo.deviceName,
        deviceModel: deviceInfo.deviceModel,
        passphrase,
      });

      if (response.success) {
        // Cache the device registration status
        const cacheKey = `device_registered_${accountId}`;
        storage.set(cacheKey, true);

        // Cache the key data
        this.cacheDeviceKeyData(accountId, response.keyData);

        onProgress?.(
          `Device registered with ${response.iterations} iterations`
        );

        return response.keyData;
      } else {
        throw new Error('Device registration failed');
      }
    } catch (error: any) {
      console.error('[DeviceManager] Registration failed:', error);

      // If device already exists, that's okay - fetch the key data
      if (error.message?.includes('already exists')) {
        return this.getDeviceKeyData(accountId);
      }

      throw error;
    }
  }

  /**
   * Get device-specific key data
   */
  async getDeviceKeyData(accountId: string): Promise<DeviceKeyData | null> {
    // Check cache first
    const cached = this.getCachedDeviceKeyData(accountId);
    if (cached) {
      console.log('[DeviceManager] Using cached device key data');
      return cached;
    }

    try {
      const deviceInfo = await this.getDeviceInfo();

      // Fetch from server
      const response = await apiClient.user.getDeviceKey({
        accountId,
        deviceId: deviceInfo.deviceId,
      });

      if (response.keyData) {
        // Cache the key data
        this.cacheDeviceKeyData(accountId, response.keyData);
        return response.keyData;
      }
    } catch (error) {
      console.log('[DeviceManager] Could not fetch device key data:', error);
    }

    return null;
  }

  /**
   * Cache device key data locally
   */
  private cacheDeviceKeyData(accountId: string, keyData: DeviceKeyData): void {
    const cacheKey = `device_key_${accountId}`;
    storage.set(cacheKey, JSON.stringify(keyData));
  }

  /**
   * Get cached device key data
   */
  private getCachedDeviceKeyData(accountId: string): DeviceKeyData | null {
    const cacheKey = `device_key_${accountId}`;
    const cached = storage.getString(cacheKey);

    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Invalid cache, clear it
        storage.delete(cacheKey);
      }
    }

    return null;
  }

  /**
   * Clear device registration for an account
   */
  clearDeviceRegistration(accountId: string): void {
    storage.delete(`device_registered_${accountId}`);
    storage.delete(`device_key_${accountId}`);
  }

  /**
   * Get optimal iterations for current device
   */
  getOptimalIterations(): number {
    return getOptimalIterations();
  }
}
