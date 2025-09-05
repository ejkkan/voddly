import { api, APIError } from 'encore.dev/api';
import { userDB } from '../db';
import { getAuthData } from '~encore/auth';
import * as crypto from 'crypto';
import { getServerEncryption } from '../lib/encryption-service';
import { decryptMasterKey } from '../lib/decrypt-helper';
import { validateAndActivateDevice } from '../lib/device-management';

// ============================================
// TYPES
// ============================================

interface CreateSubscriptionRequest {
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

interface InitializeSubscriptionRequest {
  passphrase: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  subscription_tier: string;
  subscription_status: string;
  device_slots: number;
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

// Create subscription with initial source and default profile
export const createSubscription = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/subscription',
  },
  async ({
    sourceName,
    providerType,
    credentials,
    passphrase,
  }: CreateSubscriptionRequest): Promise<{
    subscriptionId: string;
    sourceId: string;
    profileId: string;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Check if user already has an subscription (1:1 relationship)
    const existingSubscription = await userDB.queryRow<{ id: string }>`
      SELECT id FROM user_subscription WHERE user_id = ${auth.userID}
    `;

    if (existingSubscription) {
      throw APIError.alreadyExists('User already has an subscription');
    }

    // Validate passphrase
    if (!passphrase || passphrase.length < 6) {
      throw APIError.invalidArgument(
        'Passphrase must be at least 6 characters'
      );
    }

    const subscriptionId = crypto.randomUUID();
    const sourceId = crypto.randomUUID();
    const profileId = crypto.randomUUID();

    // Generate subscription master key (32 bytes for AES-256)
    const masterKey = crypto.randomBytes(32);

    // Derive key from passphrase using PBKDF2-SHA256 with mobile-optimized iterations
    const salt = crypto.randomBytes(16);
    const KDF_ITERATIONS = 100000; // Balanced for mobile performance (10x original)
    console.log('[Security] Deriving key with 100k iterations...');
    const derivedKey = crypto.pbkdf2Sync(
      passphrase,
      salt,
      KDF_ITERATIONS,
      32,
      'sha256'
    );

    // Layer 1: Wrap (encrypt) the master key with user's derived key
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    const encryptedMasterKey = cipher.update(masterKey);
    const finalMasterKey = cipher.final();
    const authTag = cipher.getAuthTag();
    const userWrapped = Buffer.concat([
      encryptedMasterKey,
      finalMasterKey,
      authTag,
    ]);

    // Layer 2: Wrap with server key for double protection (required)
    const serverEncryption = getServerEncryption();
    const { server_wrapped, server_iv } = await serverEncryption.doubleWrap(
      userWrapped
    );

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
      // Create subscription (1:1 with user) with default device slots
      await userDB.exec`
        INSERT INTO user_subscription (id, user_id, subscription_tier, subscription_status, device_slots)
        VALUES (${subscriptionId}, ${auth.userID}, 'basic', 'active', 3)
      `;

      // Store double-encrypted keys with iteration count
      await userDB.exec`
        INSERT INTO subscription_encryption (
          subscription_id, 
          master_key_wrapped,
          server_wrapped_key,
          server_iv,
          salt, 
          iv,
          kdf_iterations
        ) VALUES (
          ${subscriptionId}, 
          ${userWrapped.toString('base64')},
          ${server_wrapped},
          ${server_iv},
          ${salt.toString('base64')},
          ${iv.toString('base64')},
          ${KDF_ITERATIONS}
        )
      `;

      // Create default profile (owner)
      await userDB.exec`
        INSERT INTO profiles (id, subscription_id, name, is_owner)
        VALUES (${profileId}, ${subscriptionId}, 'Main', true)
      `;

      // Create first source
      await userDB.exec`
        INSERT INTO sources (
          id, subscription_id, name, provider_type
        ) VALUES (
          ${sourceId},
          ${subscriptionId},
          ${sourceName},
          ${providerType}
        )
      `;

      // Store encrypted credentials separately
      await userDB.exec`
        INSERT INTO source_credentials (
          source_id, encrypted_config, config_iv
        ) VALUES (
          ${sourceId},
          ${encryptedConfig.toString('base64')},
          ${sourceIv.toString('base64')}
        )
      `;
    } catch (error) {
      console.error('Failed to create subscription:', error);
      throw APIError.internal('Failed to create subscription');
    }

    return { subscriptionId, sourceId, profileId };
  }
);

// Initialize new subscription with just encryption (no sources)
export const initializeSubscription = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/subscription/initialize',
  },
  async ({
    passphrase,
  }: InitializeSubscriptionRequest): Promise<{
    subscriptionId: string;
    profileId: string;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Check if user already has an subscription (1:1 relationship)
    const existingSubscription = await userDB.queryRow<{ id: string }>`
      SELECT id FROM user_subscription WHERE user_id = ${auth.userID}
    `;

    if (existingSubscription) {
      throw APIError.alreadyExists('User already has an subscription');
    }

    // Validate passphrase
    if (!passphrase || passphrase.length < 6) {
      throw APIError.invalidArgument(
        'Passphrase must be at least 6 characters'
      );
    }

    const subscriptionId = crypto.randomUUID();
    const profileId = crypto.randomUUID();

    // Generate subscription master key (32 bytes for AES-256)
    const masterKey = crypto.randomBytes(32);

    // Derive key from passphrase using PBKDF2-SHA256 with mobile-optimized iterations
    const salt = crypto.randomBytes(16);
    const KDF_ITERATIONS = 100000; // Balanced for mobile performance (10x original)
    console.log('[Security] Deriving key with 100k iterations...');
    const derivedKey = crypto.pbkdf2Sync(
      passphrase,
      salt,
      KDF_ITERATIONS,
      32,
      'sha256'
    );

    // Layer 1: Wrap (encrypt) the master key with user's derived key
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    const encryptedMasterKey = cipher.update(masterKey);
    const finalMasterKey = cipher.final();
    const authTag = cipher.getAuthTag();
    const userWrapped = Buffer.concat([
      encryptedMasterKey,
      finalMasterKey,
      authTag,
    ]);

    // Layer 2: Wrap with server key for double protection (required)
    const serverEncryption = getServerEncryption();
    const { server_wrapped, server_iv } = await serverEncryption.doubleWrap(
      userWrapped
    );

    try {
      // Create subscription (1:1 with user) with default device slots
      await userDB.exec`
        INSERT INTO user_subscription (id, user_id, subscription_tier, subscription_status, device_slots)
        VALUES (${subscriptionId}, ${auth.userID}, 'basic', 'active', 3)
      `;

      // Store double-encrypted keys with iteration count
      await userDB.exec`
        INSERT INTO subscription_encryption (
          subscription_id, 
          master_key_wrapped,
          server_wrapped_key,
          server_iv,
          salt, 
          iv,
          kdf_iterations
        ) VALUES (
          ${subscriptionId}, 
          ${userWrapped.toString('base64')},
          ${server_wrapped},
          ${server_iv},
          ${salt.toString('base64')},
          ${iv.toString('base64')},
          ${KDF_ITERATIONS}
        )
      `;

      // Create default profile (owner)
      await userDB.exec`
        INSERT INTO profiles (id, subscription_id, name, is_owner)
        VALUES (${profileId}, ${subscriptionId}, 'Main', true)
      `;

      // No sources are created - user will add them later
    } catch (error) {
      console.error('Failed to initialize subscription:', error);
      throw APIError.internal('Failed to initialize subscription');
    }

    return { subscriptionId, profileId };
  }
);

// Get user's subscription (now just one)
export const getSubscription = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/subscription',
  },
  async (): Promise<{
    subscription: SubscriptionRow | null;
    hasEncryption?: boolean;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const subscription = await userDB.queryRow<SubscriptionRow>`
      SELECT 
        id, 
        user_id,
        subscription_tier,
        subscription_status,
        created_at
      FROM user_subscription
      WHERE user_id = ${auth.userID}
    `;

    let hasEncryption = false;
    if (subscription) {
      // Check if subscription has encryption
      const encryption = await userDB.queryRow<{ subscription_id: string }>`
        SELECT subscription_id FROM subscription_encryption WHERE subscription_id = ${subscription.id}
      `;
      hasEncryption = !!encryption;
    }

    return { subscription, hasEncryption };
  }
);

// DEPRECATED: Get subscriptions (backward compatibility - returns single subscription in array)
export const getSubscriptions = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/subscriptions',
  },
  async (): Promise<{ subscriptions: SubscriptionRow[] }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const subscription = await userDB.queryRow<SubscriptionRow>`
      SELECT 
        id, 
        user_id,
        subscription_tier,
        subscription_status,
        created_at
      FROM user_subscription
      WHERE user_id = ${auth.userID}
    `;

    return { subscriptions: subscription ? [subscription] : [] };
  }
);

// Update subscription passphrase
export const updatePassphrase = api(
  {
    expose: true,
    auth: true,
    method: 'PUT',
    path: '/subscription/passphrase',
  },
  async ({
    currentPassphrase,
    newPassphrase,
  }: UpdatePassphraseRequest): Promise<{ success: boolean }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get user's subscription
    const subscription = await userDB.queryRow<{ id: string }>`
      SELECT id FROM user_subscription WHERE user_id = ${auth.userID}
    `;

    if (!subscription) {
      throw APIError.notFound('No subscription found');
    }

    // Validate new passphrase
    if (!newPassphrase || newPassphrase.length < 6) {
      throw APIError.invalidArgument(
        'New passphrase must be at least 6 characters'
      );
    }

    // Decrypt master key with current passphrase (handles old and new encryption)
    let masterKey: Buffer;
    try {
      masterKey = await decryptMasterKey(subscription.id, currentPassphrase);
    } catch (error: any) {
      // console.error(
      //   '[updatePassphrase] Current passphrase validation failed:',
      //   error.message
      // );
      throw APIError.invalidArgument('Invalid current passphrase');
    }

    // Re-encrypt master key with new passphrase using enhanced security
    const newSalt = crypto.randomBytes(16);
    const KDF_ITERATIONS = 500000; // Always upgrade to enhanced security

    console.log('[updatePassphrase] Encrypting with 500k iterations...');
    const newDerivedKey = crypto.pbkdf2Sync(
      newPassphrase,
      newSalt,
      KDF_ITERATIONS,
      32,
      'sha256'
    );

    // Layer 1: User encryption
    const newIv = crypto.randomBytes(12);
    const newCipher = crypto.createCipheriv(
      'aes-256-gcm',
      newDerivedKey,
      newIv
    );
    const userWrapped = Buffer.concat([
      newCipher.update(masterKey),
      newCipher.final(),
      newCipher.getAuthTag(),
    ]);

    // Layer 2: Server encryption (required)
    const serverEncryption = getServerEncryption();
    const { server_wrapped, server_iv } = await serverEncryption.doubleWrap(
      userWrapped
    );

    // Update encryption data
    await userDB.exec`
      UPDATE subscription_encryption
      SET 
        master_key_wrapped = ${userWrapped.toString('base64')},
        server_wrapped_key = ${server_wrapped},
        server_iv = ${server_iv},
        salt = ${newSalt.toString('base64')},
        iv = ${newIv.toString('base64')},
        kdf_iterations = ${KDF_ITERATIONS},
        updated_at = CURRENT_TIMESTAMP
      WHERE subscription_id = ${subscription.id}
    `;

    // console.log(
    //   '[updatePassphrase] Passphrase updated with enhanced encryption'
    // );

    return { success: true };
  }
);

// Initialize encryption for existing user_subscription (migration helper)
export const initializeSubscriptionEncryption = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/subscription/initialize-encryption',
  },
  async ({
    passphrase,
    deviceId,
    deviceType,
    deviceName,
    deviceModel,
  }: InitializeEncryptionRequest & {
    deviceId?: string;
    deviceType?: 'ios' | 'tvos' | 'android' | 'web';
    deviceName?: string;
    deviceModel?: string;
  }): Promise<{ success: boolean }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get user's subscription
    const subscription = await userDB.queryRow<{ id: string }>`
      SELECT id FROM user_subscription WHERE user_id = ${auth.userID}
    `;

    if (!subscription) {
      throw APIError.notFound('No subscription found');
    }

    // Check if encryption already exists
    const existingEncryption = await userDB.queryRow<{
      subscription_id: string;
    }>`
      SELECT subscription_id FROM subscription_encryption WHERE subscription_id = ${subscription.id}
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

    // Generate subscription master key (32 bytes for AES-256)
    const masterKey = crypto.randomBytes(32);

    // Derive key from passphrase using PBKDF2-SHA256 with mobile-optimized iterations
    const salt = crypto.randomBytes(16);
    const KDF_ITERATIONS = 100000; // Balanced for mobile performance (10x original)
    console.log('[Security] Deriving key with 100k iterations...');
    const derivedKey = crypto.pbkdf2Sync(
      passphrase,
      salt,
      KDF_ITERATIONS,
      32,
      'sha256'
    );

    // Layer 1: Wrap (encrypt) the master key with user's derived key
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    const encryptedMasterKey = cipher.update(masterKey);
    const finalMasterKey = cipher.final();
    const authTag = cipher.getAuthTag();
    const userWrapped = Buffer.concat([
      encryptedMasterKey,
      finalMasterKey,
      authTag,
    ]);

    // Layer 2: Wrap with server key for double protection (required)
    const serverEncryption = getServerEncryption();
    const { server_wrapped, server_iv } = await serverEncryption.doubleWrap(
      userWrapped
    );

    try {
      // Store double-encrypted keys with iteration count
      await userDB.exec`
        INSERT INTO subscription_encryption (
          subscription_id, 
          master_key_wrapped,
          server_wrapped_key,
          server_iv,
          salt, 
          iv,
          kdf_iterations
        ) VALUES (
          ${subscription.id}, 
          ${userWrapped.toString('base64')},
          ${server_wrapped},
          ${server_iv},
          ${salt.toString('base64')},
          ${iv.toString('base64')},
          ${KDF_ITERATIONS}
        )
      `;

      // If device info is provided, register the device immediately
      if (deviceId && deviceType) {
        console.log(
          `[InitializeEncryption] Registering device ${deviceId} for new subscription`
        );

        // Get optimal iterations for device type
        const getOptimalIterations = (type: string): number => {
          switch (type) {
            case 'tvos':
              return 100000;
            case 'android':
              return 300000;
            case 'ios':
              return 500000;
            case 'web':
              return 500000;
            default:
              return 200000;
          }
        };

        const deviceIterations = getOptimalIterations(deviceType);
        const deviceSalt = crypto.randomBytes(16);
        const deviceIv = crypto.randomBytes(12);

        // Derive device-specific key
        const deviceDerivedKey = crypto.pbkdf2Sync(
          passphrase,
          deviceSalt,
          deviceIterations,
          32,
          'sha256'
        );

        // Encrypt master key with device-specific key
        const deviceCipher = crypto.createCipheriv(
          'aes-256-gcm',
          deviceDerivedKey,
          deviceIv
        );
        const encryptedForDevice = Buffer.concat([
          deviceCipher.update(masterKey),
          deviceCipher.final(),
          deviceCipher.getAuthTag(),
        ]);

        // Optional: Add server-side encryption layer for device
        let deviceServerWrapped: string | null = null;
        let deviceServerIv: string | null = null;

        try {
          const wrapped = await serverEncryption.wrapData(encryptedForDevice);
          deviceServerWrapped = wrapped.wrapped;
          deviceServerIv = wrapped.iv;
        } catch (error) {
          console.log(
            '[InitializeEncryption] Server-side encryption not available for device'
          );
        }

        // Store device registration
        await userDB.exec`
          INSERT INTO subscription_devices (
            subscription_id,
            device_id,
            device_type,
            device_name,
            device_model,
            kdf_iterations,
            master_key_wrapped,
            salt,
            iv,
            server_wrapped_key,
            server_iv
          ) VALUES (
            ${subscription.id},
            ${deviceId},
            ${deviceType},
            ${deviceName || null},
            ${deviceModel || null},
            ${deviceIterations},
            ${encryptedForDevice.toString('base64')},
            ${deviceSalt.toString('base64')},
            ${deviceIv.toString('base64')},
            ${deviceServerWrapped},
            ${deviceServerIv}
          )
        `;

        console.log(
          `[InitializeEncryption] Device ${deviceId} registered with ${deviceIterations} iterations`
        );
      }
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

// Get sources for subscription (without sensitive key data)
export const getSources = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/subscription/sources',
  },
  async (req: {
    deviceId?: string;
  }): Promise<{
    sources: SourceRow[];
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const subscription = await userDB.queryRow<{ id: string }>`
      SELECT id FROM user_subscription WHERE user_id = ${auth.userID}
    `;

    if (!subscription) {
      throw APIError.notFound('No subscription found');
    }

    const rows = userDB.query<SourceRow>`
      SELECT 
        s.id, 
        s.name, 
        s.provider_type, 
        sc.encrypted_config, 
        sc.config_iv,
        s.is_active,
        s.created_at
      FROM sources s
      LEFT JOIN source_credentials sc ON s.id = sc.source_id
      WHERE s.subscription_id = ${subscription.id} AND s.is_active = true
      ORDER BY s.created_at DESC
    `;

    const sources: SourceRow[] = [];
    for await (const row of rows) {
      sources.push(row);
    }

    return { sources };
  }
);

// Get encryption keys for decryption (separate endpoint for security)
export const getSourceDecryptionKeys = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/subscription/decryption-keys',
  },
  async (req: {
    deviceId?: string;
  }): Promise<{
    keyData: {
      master_key_wrapped: string;
      salt: string;
      iv: string;
      kdf_iterations?: number;
      server_wrapped_key?: string;
      server_iv?: string;
    } | null;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const subscription = await userDB.queryRow<{ id: string }>`
      SELECT id FROM user_subscription WHERE user_id = ${auth.userID}
    `;

    if (!subscription) {
      throw APIError.notFound('No subscription found');
    }

    // Get encryption key data
    const keyData = await userDB.queryRow<{
      master_key_wrapped: string;
      salt: string;
      iv: string;
      kdf_iterations?: number;
      server_wrapped_key?: string;
      server_iv?: string;
    }>`
      SELECT 
        master_key_wrapped, 
        salt, 
        iv,
        kdf_iterations,
        server_wrapped_key,
        server_iv
      FROM subscription_encryption
      WHERE subscription_id = ${subscription.id}
    `;

    return { keyData };
  }
);

// Add source to subscription
export const addSource = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/subscription/sources',
  },
  async ({
    name,
    providerType,
    credentials,
    passphrase,
  }: AddSourceRequest): Promise<{ sourceId: string }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    const subscription = await userDB.queryRow<{ id: string }>`
      SELECT id FROM user_subscription WHERE user_id = ${auth.userID}
    `;

    if (!subscription) {
      throw APIError.notFound('No subscription found');
    }

    // Validate passphrase
    if (!passphrase || passphrase.length < 6) {
      throw APIError.invalidArgument(
        'Passphrase must be at least 6 characters'
      );
    }

    // Decrypt master key using the new helper (handles both old and new encryption)
    let masterKey: Buffer;
    try {
      masterKey = await decryptMasterKey(subscription.id, passphrase);
    } catch (error: any) {
      console.error('[addSource] Decryption failed:', error.message);
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
          id, subscription_id, name, provider_type
        ) VALUES (
          ${sourceId},
          ${subscription.id},
          ${name},
          ${providerType}
        )
      `;

      // Store encrypted credentials separately
      await userDB.exec`
        INSERT INTO source_credentials (
          source_id, encrypted_config, config_iv
        ) VALUES (
          ${sourceId},
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
    path: '/subscription/sources/:sourceId',
  },
  async ({ sourceId }: { sourceId: string }): Promise<{ deleted: boolean }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Verify source belongs to user's subscription
    const source = await userDB.queryRow<{ id: string }>`
      SELECT s.id
      FROM sources s
      JOIN user_subscription a ON s.subscription_id = a.id
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
    path: '/subscription/sources/:sourceId/decrypt',
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

    // Get source and subscription encryption data
    const data = await userDB.queryRow<{
      encrypted_config: string;
      config_iv: string;
      master_key_wrapped: string;
      salt: string;
      iv: string;
    }>`
      SELECT 
        sc.encrypted_config,
        sc.config_iv,
        ae.master_key_wrapped,
        ae.salt,
        ae.iv
      FROM sources s
      LEFT JOIN source_credentials sc ON s.id = sc.source_id
      JOIN user_subscription a ON s.subscription_id = a.id
      JOIN subscription_encryption ae ON ae.subscription_id = a.id
      WHERE s.id = ${sourceId} AND a.user_id = ${auth.userID}
    `;

    if (!data) {
      throw APIError.notFound('Source not found');
    }

    // Derive key from passphrase
    const derivedKey = crypto.pbkdf2Sync(
      passphrase,
      Buffer.from(data.salt, 'base64'),
      10000,
      32,
      'sha256'
    );

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

// Update subscription tier and device slots
export const updateSubscription = api(
  {
    expose: true,
    auth: true,
    method: 'PUT',
    path: '/subscription/subscription',
  },
  async ({
    tier,
    deviceSlots,
  }: {
    tier: 'basic' | 'standard' | 'premium';
    deviceSlots?: number;
  }): Promise<{ success: boolean }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Default device slots based on tier if not specified
    const slots =
      deviceSlots || (tier === 'premium' ? 10 : tier === 'standard' ? 5 : 3);

    await userDB.exec`
      UPDATE user_subscription
      SET 
        subscription_tier = ${tier},
        device_slots = ${slots},
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${auth.userID}
    `;

    return { success: true };
  }
);

// Update device slots only
export const updateDeviceSlots = api(
  {
    expose: true,
    auth: true,
    method: 'PUT',
    path: '/subscription/device-slots',
  },
  async ({
    slots,
  }: {
    slots: number;
  }): Promise<{ success: boolean; currentDevices: number }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    if (slots < 1 || slots > 100) {
      throw APIError.invalidArgument('Device slots must be between 1 and 100');
    }

    // Get subscription and current device count
    const subscription = await userDB.queryRow<{ id: string }>`
      SELECT id FROM user_subscription WHERE user_id = ${auth.userID}
    `;

    if (!subscription) {
      throw APIError.notFound('Subscription not found');
    }

    // Check current device count
    const deviceCount = await userDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count 
      FROM subscription_devices 
      WHERE subscription_id = ${subscription.id}
    `;

    const currentDevices = deviceCount?.count || 0;

    if (slots < currentDevices) {
      throw APIError.invalidArgument(
        `Cannot set device slots to ${slots}. You currently have ${currentDevices} devices registered.`
      );
    }

    await userDB.exec`
      UPDATE user_subscription
      SET 
        device_slots = ${slots},
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${auth.userID}
    `;

    return { success: true, currentDevices };
  }
);
