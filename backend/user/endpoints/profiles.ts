import { api, APIError } from 'encore.dev/api';
import { getAuthData } from '~encore/auth';
import { userDB } from '../db';
import * as crypto from 'crypto';

// ============================================
// TYPES
// ============================================

interface Profile {
  id: string;
  account_id: string;
  name: string;
  has_source_restrictions: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ProfileSource {
  profile_id: string;
  source_id: string;
}

interface CreateProfileRequest {
  name: string;
  hasSourceRestrictions?: boolean;
  allowedSources?: string[];
}

interface UpdateProfileRequest {
  name?: string;
  hasSourceRestrictions?: boolean;
  allowedSources?: string[];
}

interface ProfileWithSources extends Profile {
  allowedSources?: string[];
}

// ============================================
// PROFILE MANAGEMENT
// ============================================

// Get all profiles for the user's account
export const getProfiles = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/profiles',
  },
  async (): Promise<{ profiles: ProfileWithSources[] }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get user's account
    const account = await userDB.queryRow<{ id: string }>`
      SELECT id FROM accounts WHERE user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('No account found for user');
    }

    // Get all profiles for the account
    const profileRows = userDB.query<Profile>`
      SELECT 
        id, 
        account_id, 
        name, 
        has_source_restrictions,
        created_at,
        updated_at
      FROM profiles
      WHERE account_id = ${account.id}
      ORDER BY created_at ASC
    `;

    const profiles: ProfileWithSources[] = [];

    for await (const profile of profileRows) {
      const profileWithSources: ProfileWithSources = { ...profile };

      // If profile has source restrictions, get the allowed sources
      if (profile.has_source_restrictions) {
        const sourceRows = userDB.query<{ source_id: string }>`
          SELECT source_id 
          FROM profile_sources 
          WHERE profile_id = ${profile.id}
        `;

        const allowedSources: string[] = [];
        for await (const row of sourceRows) {
          allowedSources.push(row.source_id);
        }
        profileWithSources.allowedSources = allowedSources;
      }

      profiles.push(profileWithSources);
    }

    return { profiles };
  }
);

// Create a new profile
export const createProfile = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/profiles',
  },
  async ({
    name,
    hasSourceRestrictions = false,
    allowedSources = [],
  }: CreateProfileRequest): Promise<{ profileId: string }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get user's account
    const account = await userDB.queryRow<{
      id: string;
      subscription_tier: string;
    }>`
      SELECT id, subscription_tier FROM accounts WHERE user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('No account found for user');
    }

    // Check profile limits based on subscription tier
    const currentProfileCount = await userDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM profiles WHERE account_id = ${account.id}
    `;

    const profileLimit = getProfileLimit(account.subscription_tier);
    if (currentProfileCount && currentProfileCount.count >= profileLimit) {
      throw APIError.resourceExhausted(
        `Profile limit reached. ${account.subscription_tier} plan allows ${profileLimit} profiles.`
      );
    }

    const profileId = crypto.randomUUID();

    try {
      // Create the profile
      await userDB.exec`
        INSERT INTO profiles (id, account_id, name, has_source_restrictions)
        VALUES (${profileId}, ${account.id}, ${name}, ${hasSourceRestrictions})
      `;

      // If source restrictions are enabled, add the allowed sources
      if (hasSourceRestrictions && allowedSources.length > 0) {
        for (const sourceId of allowedSources) {
          await userDB.exec`
            INSERT INTO profile_sources (profile_id, source_id)
            VALUES (${profileId}, ${sourceId})
            ON CONFLICT DO NOTHING
          `;
        }
      }
    } catch (error: any) {
      if (error.code === '23505') {
        // Unique constraint violation
        throw APIError.alreadyExists(
          `Profile with name '${name}' already exists`
        );
      }
      throw APIError.internal('Failed to create profile');
    }

    return { profileId };
  }
);

// Update a profile
export const updateProfile = api(
  {
    expose: true,
    auth: true,
    method: 'PUT',
    path: '/profiles/:profileId',
  },
  async ({
    profileId,
    name,
    hasSourceRestrictions,
    allowedSources,
  }: UpdateProfileRequest & { profileId: string }): Promise<{
    success: boolean;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Verify the profile belongs to the user's account
    const profile = await userDB.queryRow<{ account_id: string }>`
      SELECT p.account_id 
      FROM profiles p
      JOIN accounts a ON p.account_id = a.id
      WHERE p.id = ${profileId} AND a.user_id = ${auth.userID}
    `;

    if (!profile) {
      throw APIError.notFound('Profile not found');
    }

    try {
      // Update profile fields if provided
      if (name !== undefined) {
        await userDB.exec`
          UPDATE profiles 
          SET name = ${name}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${profileId}
        `;
      }

      if (hasSourceRestrictions !== undefined) {
        await userDB.exec`
          UPDATE profiles 
          SET has_source_restrictions = ${hasSourceRestrictions}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${profileId}
        `;
      }

      // Update allowed sources if provided
      if (allowedSources !== undefined) {
        // Clear existing sources
        await userDB.exec`
          DELETE FROM profile_sources WHERE profile_id = ${profileId}
        `;

        // Add new sources if restrictions are enabled
        if (hasSourceRestrictions !== false && allowedSources.length > 0) {
          for (const sourceId of allowedSources) {
            await userDB.exec`
              INSERT INTO profile_sources (profile_id, source_id)
              VALUES (${profileId}, ${sourceId})
              ON CONFLICT DO NOTHING
            `;
          }
        }
      }
    } catch (error: any) {
      if (error.code === '23505') {
        throw APIError.alreadyExists(
          `Profile with name '${name}' already exists`
        );
      }
      throw APIError.internal('Failed to update profile');
    }

    return { success: true };
  }
);

// Delete a profile
export const deleteProfile = api(
  {
    expose: true,
    auth: true,
    method: 'DELETE',
    path: '/profiles/:profileId',
  },
  async ({
    profileId,
  }: {
    profileId: string;
  }): Promise<{ success: boolean }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Verify the profile belongs to the user's account and is not the only profile
    const profileCheck = await userDB.queryRow<{
      account_id: string;
      profile_count: number;
    }>`
      SELECT 
        p.account_id,
        (SELECT COUNT(*) FROM profiles WHERE account_id = p.account_id) as profile_count
      FROM profiles p
      JOIN accounts a ON p.account_id = a.id
      WHERE p.id = ${profileId} AND a.user_id = ${auth.userID}
    `;

    if (!profileCheck) {
      throw APIError.notFound('Profile not found');
    }

    if (profileCheck.profile_count <= 1) {
      throw APIError.failedPrecondition('Cannot delete the last profile');
    }

    await userDB.exec`
      DELETE FROM profiles WHERE id = ${profileId}
    `;

    return { success: true };
  }
);

// Get sources accessible to a profile
export const getProfileSources = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/profiles/:profileId/sources',
  },
  async ({ profileId }: { profileId: string }): Promise<{ sources: any[] }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Verify the profile belongs to the user's account
    const profile = await userDB.queryRow<{
      account_id: string;
      has_source_restrictions: boolean;
    }>`
      SELECT p.account_id, p.has_source_restrictions
      FROM profiles p
      JOIN accounts a ON p.account_id = a.id
      WHERE p.id = ${profileId} AND a.user_id = ${auth.userID}
    `;

    if (!profile) {
      throw APIError.notFound('Profile not found');
    }

    // Get sources based on restrictions
    let sourceQuery;
    if (profile.has_source_restrictions) {
      // Only get explicitly allowed sources
      sourceQuery = userDB.query`
        SELECT s.id, s.name, s.provider_type, s.encrypted_config, s.config_iv, s.is_active
        FROM sources s
        JOIN profile_sources ps ON s.id = ps.source_id
        WHERE ps.profile_id = ${profileId} AND s.is_active = true
        ORDER BY s.created_at DESC
      `;
    } else {
      // Get all account sources
      sourceQuery = userDB.query`
        SELECT id, name, provider_type, encrypted_config, config_iv, is_active
        FROM sources
        WHERE account_id = ${profile.account_id} AND is_active = true
        ORDER BY created_at DESC
      `;
    }

    const sources = [];
    for await (const source of sourceQuery) {
      sources.push(source);
    }

    return { sources };
  }
);

// Helper function to determine profile limits based on subscription tier
function getProfileLimit(tier: string): number {
  switch (tier) {
    case 'basic':
      return 2;
    case 'standard':
      return 4;
    case 'premium':
      return 6;
    default:
      return 2;
  }
}

// Switch active profile (for tracking purposes)
export const switchProfile = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/profiles/:profileId/switch',
  },
  async ({
    profileId,
  }: {
    profileId: string;
  }): Promise<{ success: boolean }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Verify the profile belongs to the user's account
    const profile = await userDB.queryRow<{ id: string }>`
      SELECT p.id
      FROM profiles p
      JOIN accounts a ON p.account_id = a.id
      WHERE p.id = ${profileId} AND a.user_id = ${auth.userID}
    `;

    if (!profile) {
      throw APIError.notFound('Profile not found');
    }

    // In a real app, you might want to track the active profile in session
    // or update last_used timestamp

    return { success: true };
  }
);
