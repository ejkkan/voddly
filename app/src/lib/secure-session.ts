import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import log from '@/lib/logging';

interface SessionState {
  passphrase?: string;
  deviceRegistered?: boolean;
  accountId?: string;
  lastVerified?: number;
}

const SESSION_KEY = 'voddly_session_state';
const PASSPHRASE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

class SecureSessionManager {
  private static instance: SecureSessionManager;
  private sessionState: SessionState = {};
  private initialized = false;

  static getInstance(): SecureSessionManager {
    if (!SecureSessionManager.instance) {
      SecureSessionManager.instance = new SecureSessionManager();
    }
    return SecureSessionManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Load persisted session state
      const stored = await this.getSecureData(SESSION_KEY);
      if (stored) {
        this.sessionState = JSON.parse(stored);
        
        // Check if passphrase has expired
        if (this.sessionState.lastVerified) {
          const elapsed = Date.now() - this.sessionState.lastVerified;
          if (elapsed > PASSPHRASE_TIMEOUT) {
            log.info('[SecureSession] Passphrase expired, clearing');
            this.sessionState.passphrase = undefined;
            this.sessionState.lastVerified = undefined;
            await this.persist();
          }
        }
      }
      this.initialized = true;
      log.info('[SecureSession] Initialized', { 
        hasPassphrase: !!this.sessionState.passphrase,
        deviceRegistered: this.sessionState.deviceRegistered,
        accountId: this.sessionState.accountId
      });
    } catch (error) {
      log.error('[SecureSession] Initialization error', { error });
      this.initialized = true;
    }
  }

  private async getSecureData(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      // For web, use localStorage with a warning
      const data = localStorage.getItem(key);
      return data;
    } else {
      // For mobile, use SecureStore
      return await SecureStore.getItemAsync(key);
    }
  }

  private async setSecureData(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      // For web, use localStorage with a warning
      localStorage.setItem(key, value);
    } else {
      // For mobile, use SecureStore
      await SecureStore.setItemAsync(key, value);
    }
  }

  private async deleteSecureData(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  }

  private async persist(): Promise<void> {
    try {
      if (Object.keys(this.sessionState).length === 0) {
        await this.deleteSecureData(SESSION_KEY);
      } else {
        await this.setSecureData(SESSION_KEY, JSON.stringify(this.sessionState));
      }
    } catch (error) {
      log.error('[SecureSession] Persist error', { error });
    }
  }

  async setPassphrase(passphrase: string): Promise<void> {
    await this.initialize();
    this.sessionState.passphrase = passphrase;
    this.sessionState.lastVerified = Date.now();
    await this.persist();
    log.info('[SecureSession] Passphrase stored');
  }

  async getPassphrase(): Promise<string | undefined> {
    await this.initialize();
    
    // Check if passphrase has expired
    if (this.sessionState.passphrase && this.sessionState.lastVerified) {
      const elapsed = Date.now() - this.sessionState.lastVerified;
      if (elapsed > PASSPHRASE_TIMEOUT) {
        log.info('[SecureSession] Passphrase expired');
        this.sessionState.passphrase = undefined;
        this.sessionState.lastVerified = undefined;
        await this.persist();
        return undefined;
      }
    }
    
    return this.sessionState.passphrase;
  }

  async setDeviceRegistered(registered: boolean, accountId?: string): Promise<void> {
    await this.initialize();
    this.sessionState.deviceRegistered = registered;
    if (accountId) {
      this.sessionState.accountId = accountId;
    }
    await this.persist();
    log.info('[SecureSession] Device registration status updated', { registered, accountId });
  }

  async isDeviceRegistered(): Promise<boolean> {
    await this.initialize();
    return this.sessionState.deviceRegistered || false;
  }

  async getAccountId(): Promise<string | undefined> {
    await this.initialize();
    return this.sessionState.accountId;
  }

  async clearSession(): Promise<void> {
    this.sessionState = {};
    await this.deleteSecureData(SESSION_KEY);
    log.info('[SecureSession] Session cleared');
  }

  async refreshPassphrase(): Promise<void> {
    if (this.sessionState.passphrase) {
      this.sessionState.lastVerified = Date.now();
      await this.persist();
    }
  }
}

export const secureSession = SecureSessionManager.getInstance();