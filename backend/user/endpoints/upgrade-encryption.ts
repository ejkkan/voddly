import { api, APIError } from 'encore.dev/api';
import { userDB } from '../db';
import { getAuthData } from '~encore/auth';
// import { upgradeEncryption } from '../lib/decrypt-helper'; // Removed - using device-specific encryption instead

interface UpgradeEncryptionRequest {
  passphrase: string;
}

/**
 * Upgrade account encryption to use 500k iterations and double-layer protection
 * This is a one-time upgrade for existing accounts
 */
export const upgradeAccountEncryption = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/account/upgrade-encryption',
  },
  async ({ passphrase }: UpgradeEncryptionRequest): Promise<{
    success: boolean;
    message: string;
    iterations: number;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get user's account
    const account = await userDB.queryRow<{ id: string }>`
      SELECT id FROM user_subscription WHERE user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('No account found');
    }

    // Check current encryption status
    const encData = await userDB.queryRow<{
      kdf_iterations?: number;
      encryption_version?: number;
    }>`
      SELECT kdf_iterations, encryption_version
      FROM subscription_encryption
      WHERE subscription_id = ${account.id}
    `;

    if (!encData) {
      throw APIError.internal('No encryption data found');
    }

    // Check if already upgraded
    if (encData.kdf_iterations === 500000) {
      return {
        success: true,
        message: 'Account already using enhanced encryption',
        iterations: 500000,
      };
    }

    // Device-specific encryption handles this automatically now
    // Each device registers with optimal iterations
    return {
      success: true,
      message: 'Please use device-specific encryption - devices register automatically with optimal iterations',
      iterations: encData.kdf_iterations || 100000,
    };
  }
);

/**
 * Check encryption status for the current account
 */
export const getEncryptionStatus = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/account/encryption-status',
  },
  async (): Promise<{
    iterations: number;
    version: number;
    needsUpgrade: boolean;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const account = await userDB.queryRow<{ id: string }>`
      SELECT id FROM user_subscription WHERE user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('No account found');
    }

    const encData = await userDB.queryRow<{
      kdf_iterations?: number;
      encryption_version?: number;
    }>`
      SELECT kdf_iterations, encryption_version
      FROM subscription_encryption
      WHERE subscription_id = ${account.id}
    `;

    const iterations = encData?.kdf_iterations || 10000;
    const version = encData?.encryption_version || 1;

    return {
      iterations,
      version,
      needsUpgrade: iterations < 500000,
    };
  }
);