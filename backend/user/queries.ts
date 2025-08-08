import { userDB } from './db';

// ============================================
// Type Definitions
// ============================================

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  stripeCustomerId: string | null;
  role: string;
  banned: boolean;
  banReason: string | null;
  banExpires: number | null;
  subscriptionTier: string;
  subscriptionStatus: string | null;
  subscriptionId: string | null;
  subscriptionCurrentPeriodEnd: Date | null;
}

export interface UserPreferences {
  userId: string;
  displayName: string | null;
  avatar: string | null;
  preferredLanguage: string;
  timezone: string;
  isActive: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserPreferencesData {
  userId: string;
  displayName?: string;
  avatar?: string;
  preferredLanguage?: string;
  timezone?: string;
}

export interface UpdateUserPreferencesData {
  userId: string;
  displayName?: string;
  avatar?: string;
  preferredLanguage?: string;
  timezone?: string;
  isActive?: boolean;
}

// ============================================
// User Queries
// ============================================

export const userQueries = {
  // Find operations
  findById: (id: string) =>
    userDB.queryRow<User>`
      SELECT * FROM "user"
      WHERE id = ${id}
    `,

  findByEmail: (email: string) =>
    userDB.queryRow<User>`
      SELECT * FROM "user"
      WHERE email = ${email}
    `,

  findByStripeCustomerId: (stripeCustomerId: string) =>
    userDB.queryRow<User>`
      SELECT * FROM "user"
      WHERE "stripeCustomerId" = ${stripeCustomerId}
    `,

  findAll: (limit = 100, offset = 0) =>
    userDB.queryAll<User>`
      SELECT * FROM "user"
      ORDER BY "createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `,

  findByRole: (role: string) =>
    userDB.queryAll<User>`
      SELECT * FROM "user"
      WHERE role = ${role}
      ORDER BY "createdAt" DESC
    `,

  findBannedUsers: () =>
    userDB.queryAll<User>`
      SELECT * FROM "user"
      WHERE banned = true
      ORDER BY "createdAt" DESC
    `,

  // Create operations
  create: (user: Omit<User, 'createdAt' | 'updatedAt'>) =>
    userDB.exec`
      INSERT INTO "user" (
        id, name, email, "emailVerified", image,
        "stripeCustomerId", role, banned, "banReason", "banExpires"
      ) VALUES (
        ${user.id}, ${user.name}, ${user.email}, ${user.emailVerified}, ${user.image},
        ${user.stripeCustomerId}, ${user.role}, ${user.banned}, ${user.banReason}, ${user.banExpires}
      )
    `,

  // Delete operations
  delete: (id: string) =>
    userDB.exec`
      DELETE FROM "user"
      WHERE id = ${id}
    `,
};

// ============================================
// User Preferences Queries
// ============================================

export const userPreferencesQueries = {
  // Find operations
  findById: (userId: string) =>
    userDB.queryRow<UserPreferences>`
      SELECT 
        user_id as "userId",
        display_name as "displayName",
        avatar,
        preferred_language as "preferredLanguage",
        timezone,
        is_active as "isActive",
        last_active_at as "lastActiveAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM user_preferences
      WHERE user_id = ${userId}
    `,

  exists: (userId: string) =>
    userDB.queryRow<{ exists: boolean }>`
      SELECT EXISTS(
        SELECT 1 FROM user_preferences 
        WHERE user_id = ${userId}
      ) as exists
    `,

  // Create operation
  create: (data: CreateUserPreferencesData) =>
    userDB.exec`
      INSERT INTO user_preferences (
        user_id, display_name, avatar, preferred_language, timezone, is_active
      ) VALUES (
        ${data.userId}, ${data.displayName || null}, ${data.avatar || null},
        ${data.preferredLanguage || 'en'}, ${data.timezone || 'UTC'}, true
      )
    `,

  // Update operation
  update: (data: UpdateUserPreferencesData) =>
    userDB.exec`
      UPDATE user_preferences 
      SET 
        display_name = ${
          data.displayName !== undefined ? data.displayName : null
        },
        avatar = ${data.avatar !== undefined ? data.avatar : null},
        preferred_language = ${data.preferredLanguage || 'en'},
        timezone = ${data.timezone || 'UTC'},
        is_active = ${data.isActive !== undefined ? data.isActive : true},
        last_active_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${data.userId}
    `,

  // Update last active time
  updateLastActive: (userId: string) =>
    userDB.exec`
      UPDATE user_preferences 
      SET 
        last_active_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${userId}
    `,

  // Delete operation
  deleteById: (userId: string) =>
    userDB.exec`
      DELETE FROM user_preferences
      WHERE user_id = ${userId}
    `,
};

// ============================================
// ACCOUNT & SOURCE QUERIES
// ============================================

export interface Account {
  id: string;
  ownerUserId: string;
  name: string;
  plan: string;
  status: string;
  createdAt: Date;
}

export interface Source {
  id: string;
  accountId: string;
  name: string;
  providerType: string;
  encryptedConfig: string;
  configIv: string;
  isActive: boolean;
  createdAt: Date;
}

export interface MemberKey {
  accountId: string;
  userId: string;
  wrappedMasterKey: string;
  salt: string;
  iv: string;
  iterations: number;
}

export interface WatchState {
  userId: string;
  sourceId: string;
  contentId: string;
  contentType?: string;
  lastPositionSeconds?: number;
  totalDurationSeconds?: number;
  isFavorite: boolean;
  lastWatchedAt: Date;
}
