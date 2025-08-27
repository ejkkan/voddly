import { api, APIError } from 'encore.dev/api';
import { userDB } from '../db';
import { getAuthData } from '~encore/auth';
import * as crypto from 'crypto';
import argon2 from 'argon2';

// ============================================
// TYPES
// ============================================

interface CreateAccountRequest {
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

interface AddSourceRequest {
  name: string;
  providerType: string;
  credentials: {
    server: string;
    username: string;
    password: string;
  };
  passphrase: string;
}

interface UpdatePassphraseRequest {
  currentPassphrase: string;
  newPassphrase: string;
}

interface InitializeEncryptionRequest {
  passphrase: string;
}

interface InitializeNewAccountRequest {
  accountName: string;
  passphrase: string;
}

interface AccountRow {
  id: string;
  user_id: string;
  name: string;
  subscription_tier: string;
  subscription_status: string;
  created_at: Date;
}

interface SourceRow {
  id: string;
  name: string;
  provider_type: string;
  encrypted_config: string;
  config_iv: string;
  is_active: boolean;
  created_at: Date;
}

// ============================================
// ACCOUNT MANAGEMENT (Netflix-style, 1:1 with user)
// ============================================

// Create account with initial source and default profile
export const createAccount = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/accounts',
  },
  async ({
    accountName,
    sourceName,
    providerType,
    credentials,
    passphrase,
  }: CreateAccountRequest): Promise<{
    accountId: string;
    sourceId: string;
    profileId: string;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Check if user already has an account (1:1 relationship)
    const existingAccount = await userDB.queryRow<{ id: string }>`
      SELECT id FROM accounts WHERE user_id = ${auth.userID}
    `;

    if (existingAccount) {
      throw APIError.alreadyExists('User already has an account');
    }

    // Validate passphrase
    if (!passphrase || passphrase.length < 6) {
      throw APIError.invalidArgument(
        'Passphrase must be at least 6 characters'
      );
    }

    const accountId = crypto.randomUUID();
    const sourceId = crypto.randomUUID();
    const profileId = crypto.randomUUID();

    // Generate account master key (32 bytes for AES-256)
    const masterKey = crypto.randomBytes(32);

    // Derive key from passphrase using Argon2id with fixed params
    const salt = crypto.randomBytes(16);
    const derivedKey = await argon2.hash(passphrase, {
      type: argon2.argon2id,
      raw: true,
      hashLength: 32,
      salt: salt,
      timeCost: 3,
      memoryCost: 65536, // 64MB
      parallelism: 1,
    });

    // Wrap (encrypt) the master key with derived key
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    const encryptedMasterKey = cipher.update(masterKey);
    const finalMasterKey = cipher.final();
    const authTag = cipher.getAuthTag();
    const wrapped = Buffer.concat([
      encryptedMasterKey,
      finalMasterKey,
      authTag,
    ]);

    // Encrypt source credentials with master key
    const sourceIv = crypto.randomBytes(12);
    const sourceCipher = crypto.createCipheriv(
      'aes-256-gcm',
      masterKey,
      sourceIv
    );
    const encryptedCreds = sourceCipher.update(
      JSON.stringify(credentials),
      'utf8'
    );
    const finalCreds = sourceCipher.final();
    const sourceAuthTag = sourceCipher.getAuthTag();
    const encryptedConfig = Buffer.concat([
      encryptedCreds,
      finalCreds,
      sourceAuthTag,
    ]);

    try {
      // Create account (1:1 with user)
      await userDB.exec`
        INSERT INTO accounts (id, user_id, name, subscription_tier, subscription_status)
        VALUES (${accountId}, ${auth.userID}, ${accountName}, 'basic', 'active')
      `;

      // Store encryption key
      await userDB.exec`
        INSERT INTO account_encryption (
          account_id, master_key_wrapped, salt, iv
        ) VALUES (
          ${accountId}, 
          ${wrapped.toString('base64')},
          ${salt.toString('base64')},
          ${iv.toString('base64')}
        )
      `;

      // Create default profile (owner)
      await userDB.exec`
        INSERT INTO profiles (id, account_id, name, is_owner)
        VALUES (${profileId}, ${accountId}, 'Main', true)
      `;

      // Create first source
      await userDB.exec`
        INSERT INTO sources (
          id, account_id, name, provider_type, encrypted_config, config_iv
        ) VALUES (
          ${sourceId},
          ${accountId},
          ${sourceName},
          ${providerType},
          ${encryptedConfig.toString('base64')},
          ${sourceIv.toString('base64')}
        )
      `;
    } catch (error) {
      console.error('Failed to create account:', error);
      throw APIError.internal('Failed to create account');
    }

    return { accountId, sourceId, profileId };
  }
);

// Initialize new account with just encryption (no sources)
export const initializeNewAccount = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/account/initialize',
  },
  async ({
    accountName,
    passphrase,
  }: InitializeNewAccountRequest): Promise<{
    accountId: string;
    profileId: string;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Check if user already has an account (1:1 relationship)
    const existingAccount = await userDB.queryRow<{ id: string }>`
      SELECT id FROM accounts WHERE user_id = ${auth.userID}
    `;

    if (existingAccount) {
      throw APIError.alreadyExists('User already has an account');
    }

    // Validate passphrase
    if (!passphrase || passphrase.length < 6) {
      throw APIError.invalidArgument(
        'Passphrase must be at least 6 characters'
      );
    }

    const accountId = crypto.randomUUID();
    const profileId = crypto.randomUUID();

    // Generate account master key (32 bytes for AES-256)
    const masterKey = crypto.randomBytes(32);

    // Derive key from passphrase using Argon2id with fixed params
    const salt = crypto.randomBytes(16);
    const derivedKey = await argon2.hash(passphrase, {
      type: argon2.argon2id,
      raw: true,
      hashLength: 32,
      salt: salt,
      timeCost: 3,
      memoryCost: 65536, // 64MB
      parallelism: 1,
    });

    // Wrap (encrypt) the master key with derived key
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    const encryptedMasterKey = cipher.update(masterKey);
    const finalMasterKey = cipher.final();
    const authTag = cipher.getAuthTag();
    const wrapped = Buffer.concat([
      encryptedMasterKey,
      finalMasterKey,
      authTag,
    ]);

    try {
      // Create account (1:1 with user)
      await userDB.exec`
        INSERT INTO accounts (id, user_id, name, subscription_tier, subscription_status)
        VALUES (${accountId}, ${auth.userID}, ${accountName}, 'basic', 'active')
      `;

      // Store encryption key
      await userDB.exec`
        INSERT INTO account_encryption (
          account_id, master_key_wrapped, salt, iv
        ) VALUES (
          ${accountId}, 
          ${wrapped.toString('base64')},
          ${salt.toString('base64')},
          ${iv.toString('base64')}
        )
      `;

      // Create default profile
      await userDB.exec`
        INSERT INTO profiles (id, account_id, name)
        VALUES (${profileId}, ${accountId}, 'Main')
      `;

      // No sources are created - user will add them later
    } catch (error) {
      console.error('Failed to initialize account:', error);
      throw APIError.internal('Failed to initialize account');
    }

    return { accountId, profileId };
  }
);

// Get user's account (now just one)
export const getAccount = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/account',
  },
  async (): Promise<{
    account: AccountRow | null;
    hasEncryption?: boolean;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const account = await userDB.queryRow<AccountRow>`
      SELECT 
        id, 
        user_id,
        name,
        subscription_tier,
        subscription_status,
        created_at
      FROM accounts
      WHERE user_id = ${auth.userID}
    `;

    let hasEncryption = false;
    if (account) {
      // Check if account has encryption
      const encryption = await userDB.queryRow<{ account_id: string }>`
        SELECT account_id FROM account_encryption WHERE account_id = ${account.id}
      `;
      hasEncryption = !!encryption;
    }

    return { account, hasEncryption };
  }
);

// Get user's accounts (backward compatibility - returns single account in array)
export const getAccounts = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/accounts',
  },
  async (): Promise<{ accounts: AccountRow[] }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const account = await userDB.queryRow<AccountRow>`
      SELECT 
        id, 
        user_id,
        name,
        subscription_tier,
        subscription_status,
        created_at
      FROM accounts
      WHERE user_id = ${auth.userID}
    `;

    return { accounts: account ? [account] : [] };
  }
);

// Update account passphrase
export const updatePassphrase = api(
  {
    expose: true,
    auth: true,
    method: 'PUT',
    path: '/account/passphrase',
  },
  async ({
    currentPassphrase,
    newPassphrase,
  }: UpdatePassphraseRequest): Promise<{ success: boolean }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get user's account
    const account = await userDB.queryRow<{ id: string }>`
      SELECT id FROM accounts WHERE user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('No account found');
    }

    // Validate new passphrase
    if (!newPassphrase || newPassphrase.length < 6) {
      throw APIError.invalidArgument(
        'New passphrase must be at least 6 characters'
      );
    }

    // Get current encryption data
    const encData = await userDB.queryRow<{
      master_key_wrapped: string;
      salt: string;
      iv: string;
    }>`
      SELECT master_key_wrapped, salt, iv
      FROM account_encryption
      WHERE account_id = ${account.id}
    `;

    if (!encData) {
      throw APIError.internal('Encryption data not found');
    }

    // Verify current passphrase and decrypt master key
    const currentDerivedKey = await argon2.hash(currentPassphrase, {
      type: argon2.argon2id,
      raw: true,
      hashLength: 32,
      salt: Buffer.from(encData.salt, 'base64'),
      timeCost: 3,
      memoryCost: 65536,
      parallelism: 1,
    });

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      currentDerivedKey,
      Buffer.from(encData.iv, 'base64')
    );

    const wrapped = Buffer.from(encData.master_key_wrapped, 'base64');
    const authTag = wrapped.slice(-16);
    const ciphertext = wrapped.slice(0, -16);
    decipher.setAuthTag(authTag);

    let masterKey: Buffer;
    try {
      masterKey = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
    } catch (error) {
      throw APIError.invalidArgument('Invalid current passphrase');
    }

    // Re-encrypt master key with new passphrase
    const newSalt = crypto.randomBytes(16);
    const newDerivedKey = await argon2.hash(newPassphrase, {
      type: argon2.argon2id,
      raw: true,
      hashLength: 32,
      salt: newSalt,
      timeCost: 3,
      memoryCost: 65536,
      parallelism: 1,
    });

    const newIv = crypto.randomBytes(12);
    const newCipher = crypto.createCipheriv(
      'aes-256-gcm',
      newDerivedKey,
      newIv
    );
    const newEncryptedMasterKey = Buffer.concat([
      newCipher.update(masterKey),
      newCipher.final(),
      newCipher.getAuthTag(),
    ]);

    // Update encryption data
    await userDB.exec`
      UPDATE account_encryption
      SET 
        master_key_wrapped = ${newEncryptedMasterKey.toString('base64')},
        salt = ${newSalt.toString('base64')},
        iv = ${newIv.toString('base64')},
        updated_at = CURRENT_TIMESTAMP
      WHERE account_id = ${account.id}
    `;

    return { success: true };
  }
);

// Initialize encryption for existing accounts (migration helper)
export const initializeAccountEncryption = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/account/initialize-encryption',
  },
  async ({
    passphrase,
  }: InitializeEncryptionRequest): Promise<{ success: boolean }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get user's account
    const account = await userDB.queryRow<{ id: string }>`
      SELECT id FROM accounts WHERE user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('No account found');
    }

    // Check if encryption already exists
    const existingEncryption = await userDB.queryRow<{ account_id: string }>`
      SELECT account_id FROM account_encryption WHERE account_id = ${account.id}
    `;

    if (existingEncryption) {
      // Already has encryption, nothing to do
      return { success: true };
    }

    // Validate passphrase
    if (!passphrase || passphrase.length < 6) {
      throw APIError.invalidArgument(
        'Passphrase must be at least 6 characters'
      );
    }

    // Generate account master key (32 bytes for AES-256)
    const masterKey = crypto.randomBytes(32);

    // Derive key from passphrase using Argon2id with fixed params
    const salt = crypto.randomBytes(16);
    const derivedKey = await argon2.hash(passphrase, {
      type: argon2.argon2id,
      raw: true,
      hashLength: 32,
      salt: salt,
      timeCost: 3,
      memoryCost: 65536, // 64MB
      parallelism: 1,
    });

    // Wrap (encrypt) the master key with derived key
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    const encryptedMasterKey = cipher.update(masterKey);
    const finalMasterKey = cipher.final();
    const authTag = cipher.getAuthTag();
    const wrapped = Buffer.concat([
      encryptedMasterKey,
      finalMasterKey,
      authTag,
    ]);

    try {
      // Store encryption key
      await userDB.exec`
        INSERT INTO account_encryption (
          account_id, master_key_wrapped, salt, iv
        ) VALUES (
          ${account.id}, 
          ${wrapped.toString('base64')},
          ${salt.toString('base64')},
          ${iv.toString('base64')}
        )
      `;
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      throw APIError.internal('Failed to initialize encryption');
    }

    return { success: true };
  }
);

// ============================================
// SOURCE MANAGEMENT
// ============================================

// Get sources for account
export const getSources = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/account/sources',
  },
  async (): Promise<{
    sources: SourceRow[];
    keyData?: {
      master_key_wrapped: string;
      salt: string;
      iv: string;
    };
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const account = await userDB.queryRow<{ id: string }>`
      SELECT id FROM accounts WHERE user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('No account found');
    }

    // Get encryption key data
    const keyData = await userDB.queryRow<{
      master_key_wrapped: string;
      salt: string;
      iv: string;
    }>`
      SELECT master_key_wrapped, salt, iv
      FROM account_encryption
      WHERE account_id = ${account.id}
    `;

    const rows = userDB.query<SourceRow>`
      SELECT 
        id, 
        name, 
        provider_type, 
        encrypted_config, 
        config_iv,
        is_active,
        created_at
      FROM sources
      WHERE account_id = ${account.id} AND is_active = true
      ORDER BY created_at DESC
    `;

    const sources: SourceRow[] = [];
    for await (const row of rows) {
      sources.push(row);
    }

    return { sources, keyData: keyData || undefined };
  }
);

// Add source to account
export const addSource = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/account/sources',
  },
  async ({
    name,
    providerType,
    credentials,
    passphrase,
  }: AddSourceRequest): Promise<{ sourceId: string }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const account = await userDB.queryRow<{ id: string }>`
      SELECT id FROM accounts WHERE user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('No account found');
    }

    // Validate passphrase
    if (!passphrase || passphrase.length < 6) {
      throw APIError.invalidArgument(
        'Passphrase must be at least 6 characters'
      );
    }

    // Get account encryption to encrypt the new source
    const encData = await userDB.queryRow<{
      master_key_wrapped: string;
      salt: string;
      iv: string;
    }>`
      SELECT master_key_wrapped, salt, iv
      FROM account_encryption
      WHERE account_id = ${account.id}
    `;

    if (!encData) {
      throw APIError.internal('Account encryption not set up');
    }

    // Derive key from passphrase to decrypt master key
    const derivedKey = await argon2.hash(passphrase, {
      type: argon2.argon2id,
      raw: true,
      hashLength: 32,
      salt: Buffer.from(encData.salt, 'base64'),
      timeCost: 3,
      memoryCost: 65536,
      parallelism: 1,
    });

    // Decrypt master key
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      derivedKey,
      Buffer.from(encData.iv, 'base64')
    );

    const wrapped = Buffer.from(encData.master_key_wrapped, 'base64');
    const authTag = wrapped.slice(-16);
    const ciphertext = wrapped.slice(0, -16);
    decipher.setAuthTag(authTag);

    let masterKey: Buffer;
    try {
      masterKey = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
    } catch (error) {
      throw APIError.unauthenticated('Invalid passphrase');
    }

    // Encrypt source credentials with master key
    const sourceId = crypto.randomUUID();
    const sourceIv = crypto.randomBytes(12);
    const sourceCipher = crypto.createCipheriv(
      'aes-256-gcm',
      masterKey,
      sourceIv
    );
    const encryptedCreds = sourceCipher.update(
      JSON.stringify(credentials),
      'utf8'
    );
    const finalCreds = sourceCipher.final();
    const sourceAuthTag = sourceCipher.getAuthTag();
    const encryptedConfig = Buffer.concat([
      encryptedCreds,
      finalCreds,
      sourceAuthTag,
    ]);

    // Store encrypted source
    try {
      await userDB.exec`
        INSERT INTO sources (
          id, account_id, name, provider_type, encrypted_config, config_iv
        ) VALUES (
          ${sourceId},
          ${account.id},
          ${name},
          ${providerType},
          ${encryptedConfig.toString('base64')},
          ${sourceIv.toString('base64')}
        )
      `;
    } catch (error) {
      console.error('Failed to add source:', error);
      throw APIError.internal('Failed to add source');
    }

    return { sourceId };
  }
);

// Delete source
export const deleteSource = api(
  {
    expose: true,
    auth: true,
    method: 'DELETE',
    path: '/account/sources/:sourceId',
  },
  async ({ sourceId }: { sourceId: string }): Promise<{ deleted: boolean }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Verify source belongs to user's account
    const source = await userDB.queryRow<{ id: string }>`
      SELECT s.id
      FROM sources s
      JOIN accounts a ON s.account_id = a.id
      WHERE s.id = ${sourceId} AND a.user_id = ${auth.userID}
    `;

    if (!source) {
      throw APIError.notFound('Source not found');
    }

    await userDB.exec`
      UPDATE sources 
      SET is_active = false 
      WHERE id = ${sourceId}
    `;

    return { deleted: true };
  }
);

// Decrypt source credentials (requires passphrase)
export const decryptSource = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/account/sources/:sourceId/decrypt',
  },
  async ({
    sourceId,
    passphrase,
  }: {
    sourceId: string;
    passphrase: string;
  }): Promise<{ credentials: any }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get source and account encryption data
    const data = await userDB.queryRow<{
      encrypted_config: string;
      config_iv: string;
      master_key_wrapped: string;
      salt: string;
      iv: string;
    }>`
      SELECT 
        s.encrypted_config,
        s.config_iv,
        ae.master_key_wrapped,
        ae.salt,
        ae.iv
      FROM sources s
      JOIN accounts a ON s.account_id = a.id
      JOIN account_encryption ae ON ae.account_id = a.id
      WHERE s.id = ${sourceId} AND a.user_id = ${auth.userID}
    `;

    if (!data) {
      throw APIError.notFound('Source not found');
    }

    // Derive key from passphrase
    const derivedKey = await argon2.hash(passphrase, {
      type: argon2.argon2id,
      raw: true,
      hashLength: 32,
      salt: Buffer.from(data.salt, 'base64'),
      timeCost: 3,
      memoryCost: 65536,
      parallelism: 1,
    });

    // Decrypt master key
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      derivedKey,
      Buffer.from(data.iv, 'base64')
    );

    const wrapped = Buffer.from(data.master_key_wrapped, 'base64');
    const authTag = wrapped.slice(-16);
    const ciphertext = wrapped.slice(0, -16);
    decipher.setAuthTag(authTag);

    let masterKey: Buffer;
    try {
      masterKey = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
    } catch (error) {
      throw APIError.invalidArgument('Invalid passphrase');
    }

    // Decrypt source credentials with master key
    const sourceDecipher = crypto.createDecipheriv(
      'aes-256-gcm',
      masterKey,
      Buffer.from(data.config_iv, 'base64')
    );

    const encryptedConfig = Buffer.from(data.encrypted_config, 'base64');
    const sourceAuthTag = encryptedConfig.slice(-16);
    const sourceCiphertext = encryptedConfig.slice(0, -16);
    sourceDecipher.setAuthTag(sourceAuthTag);

    const decrypted = Buffer.concat([
      sourceDecipher.update(sourceCiphertext),
      sourceDecipher.final(),
    ]);

    const credentials = JSON.parse(decrypted.toString('utf8'));

    return { credentials };
  }
);

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

// Update subscription tier
export const updateSubscription = api(
  {
    expose: true,
    auth: true,
    method: 'PUT',
    path: '/account/subscription',
  },
  async ({
    tier,
  }: {
    tier: 'basic' | 'standard' | 'premium';
  }): Promise<{ success: boolean }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    await userDB.exec`
      UPDATE accounts
      SET 
        subscription_tier = ${tier},
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${auth.userID}
    `;

    return { success: true };
  }
);
