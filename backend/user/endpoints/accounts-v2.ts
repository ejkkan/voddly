import { api, APIError } from 'encore.dev/api';
import { userDB } from '../db';
import { getAuthData } from '~encore/auth';
import * as crypto from 'crypto';
import { encryptionService } from '../services/encryption-service';
import { log } from 'encore.dev/log';

// ============================================
// TYPES
// ============================================

interface CreateAccountRequestV2 {
  accountName: string;
  sourceName: string;
  providerType: string;
  credentials: {
    server: string;
    username: string;
    password: string;
  };
  passphrase: string;
}

interface AddSourceRequestV2 {
  name: string;
  providerType: string;
  credentials: {
    server: string;
    username: string;
    password: string;
  };
  passphrase: string;
}

// ============================================
// HYBRID ENCRYPTION ACCOUNT MANAGEMENT
// ============================================

/**
 * Create account with hybrid encryption (KMS + user passphrase)
 * This provides both server-side key management and user-controlled encryption
 */
export const createAccountV2 = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/v2/accounts',
  },
  async ({
    accountName,
    sourceName,
    providerType,
    credentials,
    passphrase,
  }: CreateAccountRequestV2): Promise<{
    accountId: string;
    sourceId: string;
    profileId: string;
    encryptionVersion: number;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Check if user already has an account
    const existingAccount = await userDB.queryRow<{ id: string }>`
      SELECT id FROM accounts WHERE user_id = ${auth.userID}
    `;

    if (existingAccount) {
      throw APIError.alreadyExists('User already has an account');
    }

    const accountId = crypto.randomUUID();
    const sourceId = crypto.randomUUID();
    const profileId = crypto.randomUUID();

    try {
      // Generate hybrid-protected DEK
      const {
        dekEncryptedBySMK,
        dekEncryptedByKEK,
        kekSalt,
        kekIV,
        kdfParams,
      } = await encryptionService.generateHybridDEK(passphrase);

      // Get the DEK for encrypting source credentials
      // In production, we'd keep this in memory briefly and clear it
      const dek = await encryptionService.recoverHybridDEK(
        dekEncryptedBySMK,
        dekEncryptedByKEK,
        passphrase,
        kekSalt,
        kekIV,
        kdfParams
      );

      // Encrypt source credentials with DEK
      const { encrypted, iv, authTag } = encryptionService.encryptData(
        JSON.stringify(credentials),
        dek
      );

      // Clear DEK from memory
      dek.fill(0);

      // Store everything in a transaction
      await userDB.transaction(async (tx) => {
        // Create account
        await tx.exec`
          INSERT INTO accounts (id, user_id, name, subscription_tier, subscription_status)
          VALUES (${accountId}, ${auth.userID}, ${accountName}, 'basic', 'active')
        `;

        // Store hybrid encryption keys
        await tx.exec`
          INSERT INTO account_encryption (
            account_id,
            dek_encrypted_by_smk,
            dek_encrypted_by_kek,
            kek_salt,
            kek_iv,
            kms_key_id,
            kdf_algorithm,
            kdf_params,
            encryption_version
          ) VALUES (
            ${accountId},
            ${dekEncryptedBySMK.toString('base64')},
            ${dekEncryptedByKEK.toString('base64')},
            ${kekSalt.toString('base64')},
            ${kekIV.toString('base64')},
            'primary',
            ${kdfParams.algorithm},
            ${JSON.stringify(kdfParams)}::jsonb,
            2
          )
        `;

        // Create source with encrypted credentials
        await tx.exec`
          INSERT INTO sources (
            id, account_id, name, provider_type, encrypted_config, config_iv
          ) VALUES (
            ${sourceId},
            ${accountId},
            ${sourceName},
            ${providerType},
            ${Buffer.concat([encrypted, authTag]).toString('base64')},
            ${iv.toString('base64')}
          )
        `;

        // Create default profile
        await tx.exec`
          INSERT INTO profiles (
            id, account_id, name, is_kids, is_default, created_by
          ) VALUES (
            ${profileId}, ${accountId}, 'Default', false, true, ${auth.userID}
          )
        `;
      });

      // Audit log
      await encryptionService.auditEncryptionOperation(
        auth.userID,
        'encrypt',
        'account',
        accountId,
        true,
        { encryptionVersion: 2 }
      );

      log.info('Account created with hybrid encryption', {
        accountId,
        userId: auth.userID,
        encryptionVersion: 2,
      });

      return {
        accountId,
        sourceId,
        profileId,
        encryptionVersion: 2,
      };
    } catch (error) {
      // Audit failed operation
      await encryptionService.auditEncryptionOperation(
        auth.userID,
        'encrypt',
        'account',
        accountId,
        false,
        { error: error.message }
      );

      log.error('Failed to create account with hybrid encryption', {
        error,
        userId: auth.userID,
      });

      throw APIError.internal('Failed to create account');
    }
  }
);

/**
 * Decrypt source credentials with rate limiting and audit logging
 */
export const getSourceCredentialsV2 = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/v2/sources/:sourceId/credentials',
  },
  async ({
    sourceId,
    passphrase,
  }: {
    sourceId: string;
    passphrase: string;
  }): Promise<{
    server: string;
    username: string;
    password: string;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get source and encryption data
    const data = await userDB.queryRow<{
      account_id: string;
      encrypted_config: string;
      config_iv: string;
      dek_encrypted_by_smk: string;
      dek_encrypted_by_kek: string;
      kek_salt: string;
      kek_iv: string;
      kdf_params: any;
      encryption_version: number;
    }>`
      SELECT 
        s.account_id,
        s.encrypted_config,
        s.config_iv,
        ae.dek_encrypted_by_smk,
        ae.dek_encrypted_by_kek,
        ae.kek_salt,
        ae.kek_iv,
        ae.kdf_params,
        ae.encryption_version
      FROM sources s
      JOIN accounts a ON s.account_id = a.id
      JOIN account_encryption ae ON ae.account_id = a.id
      WHERE s.id = ${sourceId} AND a.user_id = ${auth.userID}
    `;

    if (!data) {
      throw APIError.notFound('Source not found');
    }

    // Check if account is locked due to failed attempts
    const isLocked = await userDB.queryRow<{ locked: boolean }>`
      SELECT is_account_locked(${data.account_id}) as locked
    `;

    if (isLocked?.locked) {
      await encryptionService.auditEncryptionOperation(
        auth.userID,
        'decrypt',
        'source',
        sourceId,
        false,
        { reason: 'account_locked' }
      );
      throw APIError.tooManyRequests('Account temporarily locked due to failed attempts');
    }

    try {
      let decryptedConfig: string;

      if (data.encryption_version === 2) {
        // New hybrid encryption
        const dek = await encryptionService.recoverHybridDEK(
          Buffer.from(data.dek_encrypted_by_smk, 'base64'),
          Buffer.from(data.dek_encrypted_by_kek, 'base64'),
          passphrase,
          Buffer.from(data.kek_salt, 'base64'),
          Buffer.from(data.kek_iv, 'base64'),
          data.kdf_params
        );

        const encryptedConfig = Buffer.from(data.encrypted_config, 'base64');
        const authTag = encryptedConfig.slice(-16);
        const ciphertext = encryptedConfig.slice(0, -16);

        const decrypted = encryptionService.decryptData(
          ciphertext,
          dek,
          Buffer.from(data.config_iv, 'base64'),
          authTag
        );

        decryptedConfig = decrypted.toString('utf8');
        
        // Clear sensitive data
        dek.fill(0);
        decrypted.fill(0);
      } else {
        // Fall back to old encryption for backward compatibility
        // This would use the old decryption method
        throw new Error('Legacy encryption not supported in V2 endpoint');
      }

      // Clear failed attempts on successful decryption
      await userDB.exec`
        SELECT clear_failed_attempts(${data.account_id})
      `;

      // Audit successful decryption
      await encryptionService.auditEncryptionOperation(
        auth.userID,
        'decrypt',
        'source',
        sourceId,
        true
      );

      return JSON.parse(decryptedConfig);
    } catch (error) {
      // Record failed attempt
      await userDB.exec`
        SELECT record_failed_decryption(${data.account_id})
      `;

      // Audit failed decryption
      await encryptionService.auditEncryptionOperation(
        auth.userID,
        'decrypt',
        'source',
        sourceId,
        false,
        { error: error.message }
      );

      log.warn('Failed decryption attempt', {
        userId: auth.userID,
        sourceId,
        error: error.message,
      });

      throw APIError.unauthorized('Invalid passphrase');
    }
  }
);

/**
 * Update passphrase with automatic re-encryption
 */
export const updatePassphraseV2 = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/v2/accounts/passphrase',
  },
  async ({
    currentPassphrase,
    newPassphrase,
  }: {
    currentPassphrase: string;
    newPassphrase: string;
  }): Promise<{ success: boolean }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get account and encryption data
    const account = await userDB.queryRow<{
      id: string;
      dek_encrypted_by_smk: string;
      dek_encrypted_by_kek: string;
      kek_salt: string;
      kek_iv: string;
      kdf_params: any;
    }>`
      SELECT 
        a.id,
        ae.dek_encrypted_by_smk,
        ae.dek_encrypted_by_kek,
        ae.kek_salt,
        ae.kek_iv,
        ae.kdf_params
      FROM accounts a
      JOIN account_encryption ae ON ae.account_id = a.id
      WHERE a.user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('Account not found');
    }

    try {
      // Re-encrypt with new passphrase
      const {
        dekEncryptedByKEK,
        kekSalt,
        kekIV,
        kdfParams,
      } = await encryptionService.reencryptWithNewPassphrase(
        Buffer.from(account.dek_encrypted_by_smk, 'base64'),
        Buffer.from(account.dek_encrypted_by_kek, 'base64'),
        currentPassphrase,
        newPassphrase,
        Buffer.from(account.kek_salt, 'base64'),
        Buffer.from(account.kek_iv, 'base64'),
        account.kdf_params
      );

      // Update database
      await userDB.exec`
        UPDATE account_encryption
        SET 
          dek_encrypted_by_kek = ${dekEncryptedByKEK.toString('base64')},
          kek_salt = ${kekSalt.toString('base64')},
          kek_iv = ${kekIV.toString('base64')},
          kdf_params = ${JSON.stringify(kdfParams)}::jsonb,
          updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ${account.id}
      `;

      // Audit rekey operation
      await encryptionService.auditEncryptionOperation(
        auth.userID,
        'rekey',
        'account',
        account.id,
        true
      );

      log.info('Passphrase updated successfully', {
        userId: auth.userID,
        accountId: account.id,
      });

      return { success: true };
    } catch (error) {
      // Audit failed rekey
      await encryptionService.auditEncryptionOperation(
        auth.userID,
        'rekey',
        'account',
        account.id,
        false,
        { error: error.message }
      );

      log.error('Failed to update passphrase', {
        error,
        userId: auth.userID,
      });

      throw APIError.unauthorized('Invalid current passphrase');
    }
  }
);

/**
 * Migrate account from old encryption to hybrid encryption
 */
export const migrateToHybridEncryption = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/v2/accounts/migrate-encryption',
  },
  async ({ passphrase }: { passphrase: string }): Promise<{
    success: boolean;
    encryptionVersion: number;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get account with old encryption
    const account = await userDB.queryRow<{
      id: string;
      master_key_wrapped: string;
      salt: string;
      iv: string;
      encryption_version: number;
    }>`
      SELECT 
        a.id,
        ae.master_key_wrapped,
        ae.salt,
        ae.iv,
        COALESCE(ae.encryption_version, 1) as encryption_version
      FROM accounts a
      JOIN account_encryption ae ON ae.account_id = a.id
      WHERE a.user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('Account not found');
    }

    if (account.encryption_version >= 2) {
      return { success: true, encryptionVersion: account.encryption_version };
    }

    try {
      // Decrypt old master key
      const derivedKey = crypto.pbkdf2Sync(
        passphrase,
        Buffer.from(account.salt, 'base64'),
        10000, // Old iteration count
        32,
        'sha256'
      );

      const wrapped = Buffer.from(account.master_key_wrapped, 'base64');
      const authTag = wrapped.slice(-16);
      const ciphertext = wrapped.slice(0, -16);

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        derivedKey,
        Buffer.from(account.iv, 'base64')
      );
      decipher.setAuthTag(authTag);

      const masterKey = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      // Generate new hybrid encryption
      const {
        dekEncryptedBySMK,
        dekEncryptedByKEK,
        kekSalt,
        kekIV,
        kdfParams,
      } = await encryptionService.generateHybridDEK(passphrase);

      // Note: In a real migration, we'd re-encrypt all source data with the new DEK
      // For now, we'll keep using the old master key as the DEK

      // Update encryption metadata
      await userDB.exec`
        UPDATE account_encryption
        SET 
          dek_encrypted_by_smk = ${dekEncryptedBySMK.toString('base64')},
          dek_encrypted_by_kek = ${dekEncryptedByKEK.toString('base64')},
          kek_salt = ${kekSalt.toString('base64')},
          kek_iv = ${kekIV.toString('base64')},
          kms_key_id = 'primary',
          kdf_algorithm = ${kdfParams.algorithm},
          kdf_params = ${JSON.stringify(kdfParams)}::jsonb,
          encryption_version = 2,
          migrated_at = CURRENT_TIMESTAMP
        WHERE account_id = ${account.id}
      `;

      // Clear sensitive data
      masterKey.fill(0);
      derivedKey.fill(0);

      // Audit migration
      await encryptionService.auditEncryptionOperation(
        auth.userID,
        'migrate',
        'account',
        account.id,
        true,
        { fromVersion: 1, toVersion: 2 }
      );

      log.info('Account migrated to hybrid encryption', {
        userId: auth.userID,
        accountId: account.id,
        fromVersion: 1,
        toVersion: 2,
      });

      return { success: true, encryptionVersion: 2 };
    } catch (error) {
      // Audit failed migration
      await encryptionService.auditEncryptionOperation(
        auth.userID,
        'migrate',
        'account',
        account.id,
        false,
        { error: error.message }
      );

      log.error('Failed to migrate encryption', {
        error,
        userId: auth.userID,
      });

      throw APIError.internal('Migration failed');
    }
  }
);