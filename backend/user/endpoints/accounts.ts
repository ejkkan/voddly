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
  accountId: string;
  name: string;
  providerType: string;
  encryptedConfig: string;
  configIv: string;
}

interface InviteMemberRequest {
  email: string;
  passphrase: string;
}

interface AcceptInviteRequest {
  tempKey: string;
  newPassphrase: string;
}

interface AccountRow {
  id: string;
  owner_user_id: string;
  name: string;
  plan: string;
  status: string;
  role?: string;
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

interface MemberKeyRow {
  wrapped_master_key: string;
  salt: string;
  iv: string;
  iterations: number;
  kdf?: 'argon2id' | 'pbkdf2' | null;
  opslimit?: number | null;
  memlimit?: number | null;
  wrap_algo?: 'aes-gcm-256' | null;
}

// ============================================
// ACCOUNT MANAGEMENT
// ============================================

// Create account with initial source and encryption setup
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
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Validate passphrase
    if (!passphrase || passphrase.length < 6) {
      throw APIError.invalidArgument(
        'Passphrase must be at least 6 characters'
      );
    }

    const accountId = crypto.randomUUID();
    const sourceId = crypto.randomUUID();

    // Generate account master key (32 bytes for AES-256)
    const masterKey = crypto.randomBytes(32);

    // Derive owner's personal key from their passphrase using Argon2id
    const salt = crypto.randomBytes(16);
    // Align with libsodium MODERATE defaults
    const ARGON2_OPSLIMIT = 3; // time cost
    const ARGON2_MEMLIMIT_BYTES = 64 * 1024 * 1024; // 64 MiB
    const ownerKey = await argon2.hash(Buffer.from(passphrase, 'utf8'), {
      type: argon2.argon2id,
      raw: true,
      hashLength: 32,
      salt,
      timeCost: ARGON2_OPSLIMIT,
      memoryCost: ARGON2_MEMLIMIT_BYTES / 1024, // KiB
      parallelism: 1,
    });

    // Wrap (encrypt) the master key with owner's personal key
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', ownerKey, iv);
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

    // Store everything (Encore handles transactions automatically for multiple statements)
    try {
      // Create account
      await userDB.exec`
        INSERT INTO accounts (id, owner_user_id, name, plan, status)
        VALUES (${accountId}, ${auth.userID}, ${accountName}, 'free', 'active')
      `;

      // Add owner as member
      await userDB.exec`
        INSERT INTO account_members (account_id, user_id, role)
        VALUES (${accountId}, ${auth.userID}, 'owner')
      `;

      // Store owner's wrapped master key
      await userDB.exec`
        INSERT INTO member_keys (
          account_id, user_id, wrapped_master_key, salt, iv, iterations, kdf, opslimit, memlimit, wrap_algo
        ) VALUES (
          ${accountId}, 
          ${auth.userID},
          ${wrapped.toString('base64')},
          ${salt.toString('base64')},
          ${iv.toString('base64')},
          0,
          'argon2id',
          ${ARGON2_OPSLIMIT},
          ${ARGON2_MEMLIMIT_BYTES},
          'aes-gcm-256'
        )
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

    return { accountId, sourceId };
  }
);

// Get user's accounts
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

    const rows = userDB.query<AccountRow>`
      SELECT 
        a.id, 
        a.owner_user_id, 
        a.name, 
        a.plan, 
        a.status,
        am.role,
        a.created_at
      FROM accounts a
      JOIN account_members am ON a.id = am.account_id
      WHERE am.user_id = ${auth.userID}
      ORDER BY a.created_at DESC
    `;

    const accounts: AccountRow[] = [];
    for await (const row of rows) {
      accounts.push(row);
    }

    return { accounts };
  }
);

// ============================================
// SOURCE MANAGEMENT
// ============================================

// Get sources for account (returns encrypted configs)
export const getSources = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/accounts/:accountId/sources',
  },
  async ({
    accountId,
  }: {
    accountId: string;
  }): Promise<{
    sources: SourceRow[];
    keyData: MemberKeyRow | null;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Verify membership
    const member = await userDB.queryRow`
      SELECT role FROM account_members
      WHERE account_id = ${accountId} AND user_id = ${auth.userID}
    `;
    if (!member)
      throw APIError.permissionDenied('Not a member of this account');

    // Get sources
    const sourceRows = userDB.query<SourceRow>`
      SELECT 
        id, 
        name, 
        provider_type, 
        encrypted_config, 
        config_iv,
        is_active,
        created_at
      FROM sources
      WHERE account_id = ${accountId} AND is_active = true
      ORDER BY created_at DESC
    `;

    const sources: SourceRow[] = [];
    for await (const row of sourceRows) {
      sources.push(row);
    }

    // Get member's wrapped key for client-side decryption
    const keyData = await userDB.queryRow<MemberKeyRow>`
      SELECT wrapped_master_key, salt, iv, iterations, kdf, opslimit, memlimit, wrap_algo
      FROM member_keys
      WHERE account_id = ${accountId} AND user_id = ${auth.userID}
    `;

    return { sources, keyData };
  }
);

// Add source to existing account (client provides encrypted config)
export const addSource = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/sources',
  },
  async ({
    accountId,
    name,
    providerType,
    encryptedConfig,
    configIv,
  }: AddSourceRequest): Promise<{ sourceId: string }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Verify membership
    const member = await userDB.queryRow`
      SELECT role FROM account_members
      WHERE account_id = ${accountId} AND user_id = ${auth.userID}
    `;
    if (!member)
      throw APIError.permissionDenied('Not a member of this account');

    const sourceId = crypto.randomUUID();

    await userDB.exec`
      INSERT INTO sources (
        id, account_id, name, provider_type, encrypted_config, config_iv
      ) VALUES (
        ${sourceId},
        ${accountId},
        ${name},
        ${providerType},
        ${encryptedConfig},
        ${configIv}
      )
    `;

    return { sourceId };
  }
);

// Delete source
export const deleteSource = api(
  {
    expose: true,
    auth: true,
    method: 'DELETE',
    path: '/sources/:sourceId',
  },
  async ({ sourceId }: { sourceId: string }): Promise<{ deleted: boolean }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Verify ownership through account membership
    const source = await userDB.queryRow`
      SELECT s.account_id
      FROM sources s
      JOIN account_members am ON s.account_id = am.account_id
      WHERE s.id = ${sourceId} AND am.user_id = ${auth.userID}
    `;

    if (!source) throw APIError.notFound('Source not found or access denied');

    await userDB.exec`
      UPDATE sources 
      SET is_active = false 
      WHERE id = ${sourceId}
    `;

    return { deleted: true };
  }
);

// ============================================
// MEMBER MANAGEMENT
// ============================================

// Invite member to account
export const inviteMember = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/accounts/:accountId/invite',
  },
  async ({
    accountId,
    email,
    passphrase,
  }: InviteMemberRequest & { accountId: string }): Promise<{
    inviteToken: string;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Verify inviter is admin or owner
    const member = await userDB.queryRow<{ role: string }>`
      SELECT role FROM account_members
      WHERE account_id = ${accountId} AND user_id = ${auth.userID}
    `;

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw APIError.permissionDenied(
        'Only owners and admins can invite members'
      );
    }

    // Get inviter's wrapped master key
    const keyData = await userDB.queryRow<MemberKeyRow>`
      SELECT wrapped_master_key, salt, iv, kdf, opslimit, memlimit
      FROM member_keys
      WHERE account_id = ${accountId} AND user_id = ${auth.userID}
    `;

    if (!keyData) throw APIError.internal('Key data not found');

    // Decrypt master key using inviter's passphrase with Argon2id
    const salt = Buffer.from(keyData.salt, 'base64');
    if (keyData.kdf !== 'argon2id') {
      throw APIError.failedPrecondition(
        'Legacy member key format not supported'
      );
    }
    const timeCost = keyData.opslimit ?? 3;
    const memBytes = keyData.memlimit ?? 64 * 1024 * 1024;
    const inviterKey = await argon2.hash(Buffer.from(passphrase, 'utf8'), {
      type: argon2.argon2id,
      raw: true,
      hashLength: 32,
      salt,
      timeCost,
      memoryCost: Math.max(8 * 1024, Math.floor(memBytes / 1024)),
      parallelism: 1,
    });

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      inviterKey,
      Buffer.from(keyData.iv, 'base64')
    );

    const wrapped = Buffer.from(keyData.wrapped_master_key, 'base64');
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

    // Create temporary key for invite link
    const tempKey = crypto.randomBytes(32);
    const tempIv = crypto.randomBytes(12);
    const tempCipher = crypto.createCipheriv('aes-256-gcm', tempKey, tempIv);

    const encryptedMasterKey = Buffer.concat([
      tempCipher.update(masterKey),
      tempCipher.final(),
      tempCipher.getAuthTag(),
    ]);

    const token = crypto.randomUUID();
    const tempKeyHash = crypto
      .createHash('sha256')
      .update(tempKey)
      .digest('base64');

    // Store invite
    await userDB.exec`
      INSERT INTO pending_invites (
        token,
        account_id,
        inviter_user_id,
        invitee_email,
        encrypted_master_key,
        temp_key_hash,
        expires_at
      ) VALUES (
        ${token},
        ${accountId},
        ${auth.userID},
        ${email},
        ${Buffer.concat([encryptedMasterKey, tempIv]).toString('base64')},
        ${tempKeyHash},
        ${new Date(Date.now() + 24 * 60 * 60 * 1000)}
      )
    `;

    // In production, send email with invite link
    // For now, return the token and temp key
    const inviteData = {
      token,
      tempKey: tempKey.toString('base64'),
    };

    // TODO: Send email
    console.log(`Invite link: /invite/${token}#${tempKey.toString('base64')}`);

    return { inviteToken: token };
  }
);

// Accept invite
export const acceptInvite = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/invites/:token/accept',
  },
  async ({
    token,
    tempKey,
    newPassphrase,
  }: AcceptInviteRequest & { token: string }): Promise<{
    accountId: string;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Validate passphrase
    if (!newPassphrase || newPassphrase.length < 6) {
      throw APIError.invalidArgument(
        'Passphrase must be at least 6 characters'
      );
    }

    // Get and validate invite
    const invite = await userDB.queryRow<{
      account_id: string;
      encrypted_master_key: string;
      temp_key_hash: string;
      expires_at: Date;
      used_at: Date | null;
    }>`
      SELECT account_id, encrypted_master_key, temp_key_hash, expires_at, used_at
      FROM pending_invites
      WHERE token = ${token}
    `;

    if (!invite) throw APIError.notFound('Invalid invite token');
    if (invite.used_at) throw APIError.invalidArgument('Invite already used');
    if (invite.expires_at < new Date())
      throw APIError.invalidArgument('Invite expired');

    // Verify temp key
    const tempKeyBuffer = Buffer.from(tempKey, 'base64');
    const hash = crypto
      .createHash('sha256')
      .update(tempKeyBuffer)
      .digest('base64');
    if (hash !== invite.temp_key_hash) {
      throw APIError.invalidArgument('Invalid invite link');
    }

    // Decrypt master key with temp key
    const encrypted = Buffer.from(invite.encrypted_master_key, 'base64');
    const tempIv = encrypted.slice(-12);
    const encryptedKey = encrypted.slice(0, -12);
    const authTag = encryptedKey.slice(-16);
    const ciphertext = encryptedKey.slice(0, -16);

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      tempKeyBuffer,
      tempIv
    );
    decipher.setAuthTag(authTag);

    const masterKey = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    // Wrap master key with new member's passphrase
    const salt = crypto.randomBytes(16);
    const ARGON2_OPSLIMIT = 3; // time cost
    const ARGON2_MEMLIMIT_BYTES = 64 * 1024 * 1024; // 64 MiB
    const memberKey = await argon2.hash(Buffer.from(newPassphrase, 'utf8'), {
      type: argon2.argon2id,
      raw: true,
      hashLength: 32,
      salt,
      timeCost: ARGON2_OPSLIMIT,
      memoryCost: ARGON2_MEMLIMIT_BYTES / 1024,
      parallelism: 1,
    });

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', memberKey, iv);
    const wrapped = Buffer.concat([
      cipher.update(masterKey),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    // Add member and store their key
    try {
      // Add as member
      await userDB.exec`
        INSERT INTO account_members (account_id, user_id, role)
        VALUES (${invite.account_id}, ${auth.userID}, 'member')
        ON CONFLICT (account_id, user_id) DO NOTHING
      `;

      // Store their wrapped key
      await userDB.exec`
        INSERT INTO member_keys (
          account_id, user_id, wrapped_master_key, salt, iv, iterations, kdf, opslimit, memlimit, wrap_algo
        ) VALUES (
          ${invite.account_id},
          ${auth.userID},
          ${wrapped.toString('base64')},
          ${salt.toString('base64')},
          ${iv.toString('base64')},
          0,
          'argon2id',
          ${ARGON2_OPSLIMIT},
          ${ARGON2_MEMLIMIT_BYTES},
          'aes-gcm-256'
        )
        ON CONFLICT (account_id, user_id) 
        DO UPDATE SET 
          wrapped_master_key = EXCLUDED.wrapped_master_key,
          salt = EXCLUDED.salt,
          iv = EXCLUDED.iv,
          iterations = EXCLUDED.iterations,
          kdf = EXCLUDED.kdf,
          opslimit = EXCLUDED.opslimit,
          memlimit = EXCLUDED.memlimit,
          wrap_algo = EXCLUDED.wrap_algo
      `;

      // Mark invite as used
      await userDB.exec`
        UPDATE pending_invites 
        SET used_at = CURRENT_TIMESTAMP 
        WHERE token = ${token}
      `;
    } catch (error) {
      console.error('Failed to accept invite:', error);
      throw APIError.internal('Failed to accept invite');
    }

    return { accountId: invite.account_id };
  }
);
