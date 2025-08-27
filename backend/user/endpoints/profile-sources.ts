import { api, APIError } from 'encore.dev/api';
import { getAuthData } from '~encore/auth';
import { userDB } from '../db';

// ============================================
// TYPES
// ============================================

interface SourceInfo {
  id: string;
  name: string;
  provider_type: string;
  is_active: boolean;
  created_at: Date;
}

interface ProfileSourceInfo extends SourceInfo {
  is_restricted: boolean;
  added_at?: Date;
  notes?: string;
}

interface UpdateProfileSourcesRequest {
  sourceIds: string[];
  notes?: string;
}

// ============================================
// PROFILE SOURCE MANAGEMENT
// ============================================

// Get all sources available to the account (for selection)
export const getAccountSources = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/account/sources/available',
  },
  async (): Promise<{ sources: SourceInfo[] }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get user's account
    const account = await userDB.queryRow<{ id: string }>`
      SELECT id FROM accounts WHERE user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('No account found for user');
    }

    // Get all active sources for the account
    const sourceRows = userDB.query<SourceInfo>`
      SELECT 
        id, 
        name, 
        provider_type, 
        is_active, 
        created_at
      FROM sources
      WHERE account_id = ${account.id} AND is_active = true
      ORDER BY name ASC
    `;

    const sources: SourceInfo[] = [];
    for await (const source of sourceRows) {
      sources.push(source);
    }

    return { sources };
  }
);

// Get sources accessible to a specific profile
export const getProfileSources = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/profiles/:profileId/sources',
  },
  async ({
    profileId,
  }: {
    profileId: string;
  }): Promise<{ sources: ProfileSourceInfo[] }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Verify the profile belongs to the user's account
    const profile = await userDB.queryRow<{
      account_id: string;
      is_owner: boolean;
    }>`
      SELECT p.account_id, p.is_owner
      FROM profiles p
      JOIN accounts a ON p.account_id = a.id
      WHERE p.id = ${profileId} AND a.user_id = ${auth.userID}
    `;

    if (!profile) {
      throw APIError.notFound('Profile not found');
    }

    let sourceQuery;

    // Owner profiles always have access to all sources
    if (profile.is_owner) {
      sourceQuery = userDB.query<ProfileSourceInfo>`
        SELECT 
          id, 
          name, 
          provider_type, 
          is_active, 
          created_at,
          false as is_restricted,
          NULL as added_at,
          NULL as notes
        FROM sources
        WHERE account_id = ${profile.account_id} AND is_active = true
        ORDER BY name ASC
      `;
    } else {
      // Check if profile has any source restrictions
      const restrictionCount = await userDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM profile_sources
        WHERE profile_id = ${profileId}
      `;

      if (restrictionCount && restrictionCount.count === 0) {
        // No restrictions: return all account sources
        sourceQuery = userDB.query<ProfileSourceInfo>`
          SELECT 
            id, 
            name, 
            provider_type, 
            is_active, 
            created_at,
            false as is_restricted,
            NULL as added_at,
            NULL as notes
          FROM sources
          WHERE account_id = ${profile.account_id} AND is_active = true
          ORDER BY name ASC
        `;
      } else {
        // Has restrictions: return only explicitly allowed sources
        sourceQuery = userDB.query<ProfileSourceInfo>`
          SELECT 
            s.id, 
            s.name, 
            s.provider_type, 
            s.is_active, 
            s.created_at,
            true as is_restricted,
            ps.added_at,
            ps.notes
          FROM sources s
          JOIN profile_sources ps ON s.id = ps.source_id
          WHERE ps.profile_id = ${profileId} AND s.is_active = true
          ORDER BY s.name ASC
        `;
      }
    }

    const sources: ProfileSourceInfo[] = [];
    for await (const source of sourceQuery) {
      sources.push(source);
    }

    return { sources };
  }
);

// Update profile source restrictions (owner only)
export const updateProfileSources = api(
  {
    expose: true,
    auth: true,
    method: 'PUT',
    path: '/profiles/:profileId/sources',
  },
  async ({
    profileId,
    sourceIds,
    notes,
  }: UpdateProfileSourcesRequest & { profileId: string }): Promise<{
    success: boolean;
  }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // First check if the current user is the account owner
    const userAccount = await userDB.queryRow<{
      account_id: string;
    }>`
      SELECT a.id as account_id
      FROM accounts a
      JOIN profiles p ON a.id = p.account_id
      WHERE a.user_id = ${auth.userID} AND p.is_owner = true
    `;

    if (!userAccount) {
      throw APIError.permissionDenied(
        'Only account owners can modify source restrictions'
      );
    }

    // Verify the profile belongs to the user's account
    const profile = await userDB.queryRow<{
      account_id: string;
      is_owner: boolean;
    }>`
      SELECT p.account_id, p.is_owner
      FROM profiles p
      WHERE p.id = ${profileId} AND p.account_id = ${userAccount.account_id}
    `;

    if (!profile) {
      throw APIError.notFound('Profile not found');
    }

    // Prevent modifying source restrictions for owner profiles (they always have access to all sources)
    if (profile.is_owner) {
      throw APIError.failedPrecondition(
        'Cannot modify source restrictions for owner profile - they always have access to all sources'
      );
    }

    // Verify all source IDs belong to the account
    if (sourceIds.length > 0) {
      const validSources = await userDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM sources
        WHERE id = ANY(${sourceIds}::UUID[]) AND account_id = ${profile.account_id}
      `;

      if (!validSources || validSources.count !== sourceIds.length) {
        throw APIError.invalidArgument(
          'One or more sources do not belong to this account'
        );
      }
    }

    try {
      // Clear existing source restrictions
      await userDB.exec`
        DELETE FROM profile_sources WHERE profile_id = ${profileId}
      `;

      // Add new source restrictions if any
      if (sourceIds.length > 0) {
        // Add the selected sources
        for (const sourceId of sourceIds) {
          await userDB.exec`
            INSERT INTO profile_sources (profile_id, source_id, added_by, notes)
            VALUES (${profileId}, ${sourceId}, ${profileId}, ${notes || null})
          `;
        }
      }
      // If sourceIds is empty, the profile will have no restrictions (access to all sources)
    } catch (error: any) {
      throw APIError.internal('Failed to update profile sources');
    }

    return { success: true };
  }
);

// Remove a specific source from a profile
export const removeProfileSource = api(
  {
    expose: true,
    auth: true,
    method: 'DELETE',
    path: '/profiles/:profileId/sources/:sourceId',
  },
  async ({
    profileId,
    sourceId,
  }: {
    profileId: string;
    sourceId: string;
  }): Promise<{ success: boolean }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // First check if the current user is the account owner
    const userAccount = await userDB.queryRow<{
      account_id: string;
    }>`
      SELECT a.id as account_id
      FROM accounts a
      JOIN profiles p ON a.id = p.account_id
      WHERE a.user_id = ${auth.userID} AND p.is_owner = true
    `;

    if (!userAccount) {
      throw APIError.permissionDenied(
        'Only account owners can modify source restrictions'
      );
    }

    // Verify the profile belongs to the user's account
    const profile = await userDB.queryRow<{
      account_id: string;
      is_owner: boolean;
    }>`
      SELECT p.account_id, p.is_owner
      FROM profiles p
      WHERE p.id = ${profileId} AND p.account_id = ${userAccount.account_id}
    `;

    if (!profile) {
      throw APIError.notFound('Profile not found');
    }

    // Prevent modifying source restrictions for owner profiles (they always have access to all sources)
    if (profile.is_owner) {
      throw APIError.failedPrecondition(
        'Cannot modify source restrictions for owner profile - they always have access to all sources'
      );
    }

    // Remove the specific source
    await userDB.exec`
      DELETE FROM profile_sources 
      WHERE profile_id = ${profileId} AND source_id = ${sourceId}
    `;

    // Note: No need to update has_source_restrictions flag anymore
    // The profile will automatically have access to all sources if profile_sources is empty

    return { success: true };
  }
);

// Get profile source audit information
export const getProfileSourceAudit = api(
  {
    expose: true,
    auth: true,
    method: 'GET',
    path: '/profiles/sources/audit',
  },
  async (): Promise<{ audit: any[] }> => {
    const auth = getAuthData();
    if (!auth?.userID) throw APIError.unauthenticated('Unauthorized');

    // Get user's account
    const account = await userDB.queryRow<{ id: string }>`
      SELECT id FROM accounts WHERE user_id = ${auth.userID}
    `;

    if (!account) {
      throw APIError.notFound('No account found for user');
    }

    // Get audit information for all profiles in the account
    const auditRows = userDB.query`
      SELECT 
        p.id as profile_id,
        p.name as profile_name,
        s.id as source_id,
        s.name as source_name,
        s.provider_type,
        ps.added_at,
        ps.notes,
        CASE 
          WHEN ps.added_by IS NOT NULL THEN 'explicitly_allowed'
          ELSE 'inherited'
        END as access_type
      FROM profiles p
      LEFT JOIN profile_sources ps ON p.id = ps.profile_id
      LEFT JOIN sources s ON ps.source_id = s.id
      WHERE p.account_id = ${account.id}
      ORDER BY p.name, s.name
    `;

    const audit: any[] = [];
    for await (const row of auditRows) {
      audit.push(row);
    }

    return { audit };
  }
);
