import { api, APIError } from 'encore.dev/api';
import { getAuthData } from '~encore/auth';
import { userDB } from '../db';
import * as crypto from 'crypto';

// ============================================
// TYPES
// ============================================

interface Profile {
  id: string;
  subscription_id: string;
  name: string;
  has_source_restrictions: boolean;
  is_owner: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ProfileSource {
  profile_id: string;
  source_id: string;
}

interface CreateProfileRequest {
  name: string;
  allowedSources?: string[];
}

interface UpdateProfileRequest {
  name?: string;
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
      SELECT id FROM user_subscription WHERE user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('No account found for user');
    }

    // Get all profiles for the account
    const profileRows = userDB.query<Profile>`
      SELECT 
        id, 
        subscription_id, 
        name, 
        is_owner,
        created_at,
        updated_at
      FROM profiles
      WHERE subscription_id = ${account.id}
      ORDER BY created_at ASC
    `;

    const profiles: ProfileWithSources[] = [];

    for await (const profile of profileRows) {
      const profileWithSources: ProfileWithSources = { ...profile };

      // Get the allowed sources for this profile
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
    allowedSources = [],
  }: CreateProfileRequest): Promise<{
    profileId: string;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get user's account
    const account = await userDB.queryRow<{
      id: string;
      subscription_tier: string;
    }>`
      SELECT id, subscription_tier FROM user_subscription WHERE user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('No account found for user');
    }

    // Check if user is the account owner by checking if they have an owner profile
    const ownerProfile = await userDB.queryRow<{ id: string }>`
      SELECT id FROM profiles 
      WHERE subscription_id = ${account.id} AND is_owner = true
    `;

    if (!ownerProfile) {
      throw APIError.permissionDenied(
        'Only account owners can create profiles'
      );
    }

    // Check profile limits based on subscription tier
    const currentProfileCount = await userDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM profiles WHERE subscription_id = ${account.id}
    `;

    const profileLimit = getProfileLimit(account.subscription_tier);
    if (currentProfileCount && currentProfileCount.count >= profileLimit) {
      throw APIError.resourceExhausted(
        `Profile limit reached. ${account.subscription_tier} plan allows ${profileLimit} profiles.`
      );
    }

    const profileId = crypto.randomUUID();

    try {
      // Create the profile (only the account owner can create profiles)
      await userDB.exec`
        INSERT INTO profiles (id, subscription_id, name, is_owner)
        VALUES (${profileId}, ${account.id}, ${name}, false)
      `;

      // If specific sources are provided, add them to profile_sources
      if (allowedSources.length > 0) {
        for (const sourceId of allowedSources) {
          await userDB.exec`
            INSERT INTO profile_sources (profile_id, source_id)
            VALUES (${profileId}, ${sourceId})
            ON CONFLICT DO NOTHING
          `;
        }
      }
      // If no sources provided, profile will have access to all sources (no restrictions)
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
    allowedSources,
  }: UpdateProfileRequest & { profileId: string }): Promise<{
    success: boolean;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // First check if the current user is the account owner
    const userAccount = await userDB.queryRow<{
      subscription_id: string;
    }>`
      SELECT a.id as subscription_id
      FROM user_subscription a
      JOIN profiles p ON a.id = p.subscription_id
      WHERE a.user_id = ${auth.userID} AND p.is_owner = true
    `;

    if (!userAccount) {
      throw APIError.permissionDenied('Only account owners can edit profiles');
    }

    // Verify the profile belongs to the user's account
    const profile = await userDB.queryRow<{ subscription_id: string }>`
      SELECT p.subscription_id 
      FROM profiles p
      WHERE p.id = ${profileId} AND p.subscription_id = ${userAccount.subscription_id}
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

      // Update allowed sources if provided
      if (allowedSources !== undefined) {
        // Clear existing sources
        await userDB.exec`
          DELETE FROM profile_sources WHERE profile_id = ${profileId}
        `;

        // Add new sources if any are specified
        if (allowedSources.length > 0) {
          for (const sourceId of allowedSources) {
            await userDB.exec`
              INSERT INTO profile_sources (profile_id, source_id)
              VALUES (${profileId}, ${sourceId})
              ON CONFLICT DO NOTHING
            `;
          }
        }
        // If allowedSources is empty, profile will have access to all sources (no restrictions)
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

    // First check if the current user is the account owner
    const userAccount = await userDB.queryRow<{
      subscription_id: string;
    }>`
      SELECT a.id as subscription_id
      FROM user_subscription a
      JOIN profiles p ON a.id = p.subscription_id
      WHERE a.user_id = ${auth.userID} AND p.is_owner = true
    `;

    if (!userAccount) {
      throw APIError.permissionDenied(
        'Only account owners can delete profiles'
      );
    }

    // Verify the profile belongs to the user's account and is not the only profile
    const profileCheck = await userDB.queryRow<{
      profile_count: number;
    }>`
      SELECT 
        (SELECT COUNT(*) FROM profiles WHERE subscription_id = ${userAccount.subscription_id}) as profile_count
      FROM profiles p
      WHERE p.id = ${profileId} AND p.subscription_id = ${userAccount.subscription_id}
    `;

    if (!profileCheck) {
      throw APIError.notFound('Profile not found');
    }

    // Prevent deleting the owner profile
    const isOwnerProfile = await userDB.queryRow<{ is_owner: boolean }>`
      SELECT is_owner FROM profiles WHERE id = ${profileId}
    `;

    if (isOwnerProfile?.is_owner) {
      throw APIError.failedPrecondition('Cannot delete the owner profile');
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

// Note: getProfileSources has been moved to profile-sources.ts for enhanced functionality

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
      JOIN user_subscription a ON p.subscription_id = a.id
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

// Check if current user is owner of a profile
export const isProfileOwner = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/profiles/:profileId/owner',
  },
  async ({
    profileId,
  }: {
    profileId: string;
  }): Promise<{ isOwner: boolean }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get user's account
    const account = await userDB.queryRow<{ id: string }>`
      SELECT id FROM user_subscription WHERE user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('No account found for user');
    }

    // Check if the profile belongs to the user's account and is owned by them
    const profile = await userDB.queryRow<{ is_owner: boolean }>`
      SELECT is_owner 
      FROM profiles 
      WHERE id = ${profileId} AND subscription_id = ${account.id}
    `;

    if (!profile) {
      throw APIError.notFound('Profile not found');
    }

    return { isOwner: profile.is_owner };
  }
);

// Owner-only: Update profile (only owner can modify profiles)
export const updateProfileAsOwner = api(
  {
    expose: true,
    auth: true,
    method: 'PUT',
    path: '/profiles/:profileId/owner',
  },
  async ({
    profileId,
    name,
    allowedSources,
  }: UpdateProfileRequest & { profileId: string }): Promise<{
    success: boolean;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Verify the profile belongs to the user's account and they are the owner
    const profile = await userDB.queryRow<{
      subscription_id: string;
      is_owner: boolean;
    }>`
      SELECT p.subscription_id, p.is_owner
      FROM profiles p
      JOIN user_subscription a ON p.subscription_id = a.id
      WHERE p.id = ${profileId} AND a.user_id = ${auth.userID}
    `;

    if (!profile) {
      throw APIError.notFound('Profile not found');
    }

    if (!profile.is_owner) {
      throw APIError.permissionDenied('Only profile owner can modify profiles');
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

      // Update allowed sources if provided
      if (allowedSources !== undefined) {
        // Clear existing sources
        await userDB.exec`
          DELETE FROM profile_sources WHERE profile_id = ${profileId}
        `;

        // Add new sources if any are specified
        if (allowedSources.length > 0) {
          for (const sourceId of allowedSources) {
            await userDB.exec`
              INSERT INTO profile_sources (profile_id, source_id)
              VALUES (${profileId}, ${sourceId})
              ON CONFLICT DO NOTHING
            `;
          }
        }
        // If allowedSources is empty, profile will have access to all sources (no restrictions)
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

// Owner-only: Delete profile (only owner can delete profiles)
export const deleteProfileAsOwner = api(
  {
    expose: true,
    auth: true,
    method: 'DELETE',
    path: '/profiles/:profileId/owner',
  },
  async ({
    profileId,
  }: {
    profileId: string;
  }): Promise<{ success: boolean }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // First check if the current user is the account owner
    const userAccount = await userDB.queryRow<{
      subscription_id: string;
    }>`
      SELECT a.id as subscription_id
      FROM user_subscription a
      JOIN profiles p ON a.id = p.subscription_id
      WHERE a.user_id = ${auth.userID} AND p.is_owner = true
    `;

    if (!userAccount) {
      throw APIError.permissionDenied(
        'Only account owners can delete profiles'
      );
    }

    // Verify the profile belongs to the user's account
    const profileCheck = await userDB.queryRow<{
      profile_count: number;
    }>`
      SELECT 
        (SELECT COUNT(*) FROM profiles WHERE subscription_id = ${userAccount.subscription_id}) as profile_count
      FROM profiles p
      WHERE p.id = ${profileId} AND p.subscription_id = ${userAccount.subscription_id}
    `;

    if (!profileCheck) {
      throw APIError.notFound('Profile not found');
    }

    // Prevent deleting the owner profile
    const isOwnerProfile = await userDB.queryRow<{ is_owner: boolean }>`
      SELECT is_owner FROM profiles WHERE id = ${profileId}
    `;

    if (isOwnerProfile?.is_owner) {
      throw APIError.failedPrecondition('Cannot delete the owner profile');
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

// Owner-only: Create a new profile (only account owner can create profiles)
export const createProfileAsOwner = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/profiles/owner',
  },
  async ({
    name,
    allowedSources = [],
  }: CreateProfileRequest): Promise<{ profileId: string }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get user's account
    const account = await userDB.queryRow<{
      id: string;
      subscription_tier: string;
    }>`
      SELECT id, subscription_tier FROM user_subscription WHERE user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('No account found for user');
    }

    // Check if user is the account owner by checking if they have an owner profile
    const ownerProfile = await userDB.queryRow<{ id: string }>`
      SELECT id FROM profiles 
      WHERE subscription_id = ${account.id} AND is_owner = true
    `;

    if (!ownerProfile) {
      throw APIError.permissionDenied(
        'Only account owners can create profiles'
      );
    }

    // Check profile limits based on subscription tier
    const currentProfileCount = await userDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM profiles WHERE subscription_id = ${account.id}
    `;

    const profileLimit = getProfileLimit(account.subscription_tier);
    if (currentProfileCount && currentProfileCount.count >= profileLimit) {
      throw APIError.resourceExhausted(
        `Profile limit reached. ${account.subscription_tier} plan allows ${profileLimit} profiles.`
      );
    }

    const profileId = crypto.randomUUID();

    try {
      // Create the profile (non-owner profile)
      await userDB.exec`
        INSERT INTO profiles (id, subscription_id, name, is_owner)
        VALUES (${profileId}, ${account.id}, ${name}, false)
      `;

      // If specific sources are provided, add them to profile_sources
      if (allowedSources.length > 0) {
        for (const sourceId of allowedSources) {
          await userDB.exec`
            INSERT INTO profile_sources (profile_id, source_id)
            VALUES (${profileId}, ${sourceId})
            ON CONFLICT DO NOTHING
          `;
        }
      }
      // If no sources provided, profile will have access to all sources (no restrictions)
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

// Fix owner status for existing profiles (one-time fix for migration issues)
export const fixProfileOwnerStatus = api(
  {
    expose: true,
    auth: true,
    method: 'POST',
    path: '/profiles/fix-owner-status',
  },
  async (): Promise<{ success: boolean; message: string }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get user's account
    const account = await userDB.queryRow<{ id: string }>`
      SELECT id FROM user_subscription WHERE user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('No account found for user');
    }

    // Check if there's already an owner profile
    const existingOwner = await userDB.queryRow<{ id: string }>`
      SELECT id FROM profiles 
      WHERE subscription_id = ${account.id} AND is_owner = true
    `;

    if (existingOwner) {
      return {
        success: true,
        message: 'Account already has an owner profile',
      };
    }

    // Find the first profile (oldest) and make it the owner
    const firstProfile = await userDB.queryRow<{ id: string; name: string }>`
      SELECT id, name FROM profiles 
      WHERE subscription_id = ${account.id}
      ORDER BY created_at ASC
      LIMIT 1
    `;

    if (!firstProfile) {
      throw APIError.notFound('No profiles found for account');
    }

    // Update the first profile to be the owner
    await userDB.exec`
      UPDATE profiles 
      SET is_owner = true 
      WHERE id = ${firstProfile.id}
    `;

    return {
      success: true,
      message: `Profile '${firstProfile.name}' is now the account owner`,
    };
  }
);
