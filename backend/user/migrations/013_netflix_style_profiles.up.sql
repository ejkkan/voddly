-- =====================================================
-- NETFLIX-STYLE PROFILE SYSTEM MIGRATION
-- Description: Converts multi-tenancy account sharing to Netflix-style profiles
-- Changes:
--   - Removes account_members (many-to-many) in favor of 1:1 user-account
--   - Removes member_keys in favor of single account encryption
--   - Adds profiles table for multiple profiles per account
--   - Adds profile source restrictions for parental controls
--   - Migrates watch history from per-user to per-profile
-- =====================================================

-- Step 1: Create temporary tables to preserve data during migration
-- =====================================================

-- Store account owner relationships before dropping account_members
CREATE TEMP TABLE temp_account_owners AS
SELECT DISTINCT ON (a.id) 
  a.id as account_id,
  COALESCE(am.user_id, a.owner_user_id) as user_id,
  a.name as account_name
FROM accounts a
LEFT JOIN account_members am ON a.id = am.account_id AND am.role = 'owner';

-- Store all account members for profile creation
CREATE TEMP TABLE temp_account_members AS
SELECT 
  am.account_id,
  am.user_id,
  am.role,
  u.name as user_name
FROM account_members am
JOIN "user" u ON am.user_id = u.id;

-- Store encryption keys from first member (owner)
CREATE TEMP TABLE temp_account_encryption AS
SELECT DISTINCT ON (mk.account_id)
  mk.account_id,
  mk.wrapped_master_key,
  mk.salt,
  mk.iv
FROM member_keys mk
JOIN temp_account_owners tao ON mk.account_id = tao.account_id AND mk.user_id = tao.user_id;

-- Step 2: Create new tables for profile system
-- =====================================================

-- Create profiles table (Netflix-style)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  has_source_restrictions BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, name)
);

CREATE INDEX idx_profiles_account ON profiles(account_id);

-- Create profile source restrictions (for parental controls)
CREATE TABLE IF NOT EXISTS profile_sources (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, source_id)
);

CREATE INDEX idx_profile_sources_profile ON profile_sources(profile_id);
CREATE INDEX idx_profile_sources_source ON profile_sources(source_id);

-- Create simplified account encryption table
CREATE TABLE IF NOT EXISTS account_encryption (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  master_key_wrapped TEXT NOT NULL,
  salt TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create profile watch state table (renamed from member_watch_state)
CREATE TABLE IF NOT EXISTS profile_watch_state (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  content_type TEXT,
  last_position_seconds INT,
  total_duration_seconds INT,
  is_favorite BOOLEAN DEFAULT false,
  last_watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (profile_id, content_id)
);

CREATE INDEX idx_watch_state_profile ON profile_watch_state(profile_id);
CREATE INDEX idx_watch_state_last_watched ON profile_watch_state(profile_id, last_watched_at DESC);

-- Step 3: Modify accounts table for 1:1 user relationship
-- =====================================================

-- Add new columns to accounts table
ALTER TABLE accounts 
  ADD COLUMN IF NOT EXISTS user_id VARCHAR(255) REFERENCES "user"(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'basic' 
    CHECK (subscription_tier IN ('basic', 'standard', 'premium')),
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP;

-- Populate user_id from the temp table
UPDATE accounts a
SET user_id = tao.user_id
FROM temp_account_owners tao
WHERE a.id = tao.account_id
  AND a.user_id IS NULL;

-- Step 4: Migrate subscription data from user to accounts
-- =====================================================

UPDATE accounts a
SET 
  subscription_tier = COALESCE(u.subscription_tier, 'basic'),
  subscription_status = u.subscription_status,
  subscription_id = u.subscription_id,
  stripe_customer_id = u."stripeCustomerId",
  subscription_current_period_end = u.subscription_current_period_end
FROM "user" u
WHERE a.user_id = u.id
  AND a.subscription_tier IS NULL;

-- Step 5: Migrate data to new profile system
-- =====================================================

-- Create profiles for each account
-- First, create main profile for account owner
INSERT INTO profiles (account_id, name)
SELECT DISTINCT
  tao.account_id,
  COALESCE(
    CASE 
      WHEN tao.account_name LIKE '%''s Account' THEN REPLACE(tao.account_name, '''s Account', '')
      ELSE u.name
    END,
    'Main'
  )
FROM temp_account_owners tao
JOIN "user" u ON tao.user_id = u.id
ON CONFLICT DO NOTHING;

-- Create additional profiles for other members (if any)
WITH other_members AS (
  SELECT 
    tam.account_id,
    tam.user_name,
    ROW_NUMBER() OVER (PARTITION BY tam.account_id, tam.user_name ORDER BY tam.user_id) as dup_num
  FROM temp_account_members tam
  WHERE (tam.account_id, tam.user_id) NOT IN (
    SELECT account_id, user_id FROM temp_account_owners
  )
)
INSERT INTO profiles (account_id, name)
SELECT 
  account_id,
  CASE 
    WHEN dup_num > 1 THEN user_name || ' ' || dup_num
    ELSE user_name
  END
FROM other_members
ON CONFLICT DO NOTHING;

-- Migrate encryption keys to new table
INSERT INTO account_encryption (account_id, master_key_wrapped, salt, iv, created_at)
SELECT 
  account_id,
  wrapped_master_key,
  salt,
  iv,
  CURRENT_TIMESTAMP
FROM temp_account_encryption
ON CONFLICT DO NOTHING;

-- Migrate watch history to profile-based
-- First, try to match existing member_watch_state to profiles
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'member_watch_state') THEN
    INSERT INTO profile_watch_state (
      profile_id,
      content_id,
      source_id,
      content_type,
      last_position_seconds,
      total_duration_seconds,
      is_favorite,
      last_watched_at
    )
    SELECT 
      p.id as profile_id,
      mws.content_id,
      mws.source_id,
      mws.content_type,
      mws.last_position_seconds,
      mws.total_duration_seconds,
      mws.is_favorite,
      mws.last_watched_at
    FROM member_watch_state mws
    JOIN temp_account_members tam ON mws.user_id = tam.user_id
    JOIN profiles p ON p.account_id = tam.account_id
    WHERE p.name = tam.user_name
      OR p.name = CASE 
        WHEN tam.role = 'owner' THEN 'Main'
        ELSE tam.user_name
      END
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Step 6: Clean up - Make user_id required and unique
-- =====================================================

-- Make user_id required (only if all accounts have been assigned)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM accounts WHERE user_id IS NULL
  ) THEN
    ALTER TABLE accounts 
      ALTER COLUMN user_id SET NOT NULL;
    
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'accounts_user_id_unique'
    ) THEN
      ALTER TABLE accounts 
        ADD CONSTRAINT accounts_user_id_unique UNIQUE (user_id);
    END IF;
  END IF;
END $$;

-- Step 7: Drop old columns and tables
-- =====================================================

-- Drop the old owner_user_id column if it exists
ALTER TABLE accounts DROP COLUMN IF EXISTS owner_user_id;

-- Remove subscription fields from user table
ALTER TABLE "user"
  DROP COLUMN IF EXISTS subscription_tier,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS subscription_id,
  DROP COLUMN IF EXISTS "stripeCustomerId",
  DROP COLUMN IF EXISTS subscription_current_period_end;

-- Drop the old tables (this will cascade delete all data in them)
DROP TABLE IF EXISTS pending_invites CASCADE;
DROP TABLE IF EXISTS account_members CASCADE;
DROP TABLE IF EXISTS member_keys CASCADE;
DROP TABLE IF EXISTS member_watch_state CASCADE;

-- Step 8: Create update trigger for profiles
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_account_encryption_updated_at ON account_encryption;
CREATE TRIGGER update_account_encryption_updated_at 
    BEFORE UPDATE ON account_encryption 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Step 9: Add helpful comments
-- =====================================================

COMMENT ON TABLE accounts IS 'User accounts - 1:1 with users, holds subscription info';
COMMENT ON TABLE profiles IS 'Netflix-style profiles within an account';
COMMENT ON TABLE profile_sources IS 'Source restrictions per profile for parental controls';
COMMENT ON TABLE account_encryption IS 'Single encryption key per account, protected by account passphrase';
COMMENT ON TABLE profile_watch_state IS 'Watch history and favorites per profile';

COMMENT ON COLUMN accounts.user_id IS 'One account per user (1:1 relationship)';
COMMENT ON COLUMN accounts.subscription_tier IS 'Determines device limits: basic=2, standard=4, premium=6';
COMMENT ON COLUMN profiles.has_source_restrictions IS 'If true, profile can only access sources in profile_sources table';
COMMENT ON COLUMN account_encryption.master_key_wrapped IS 'Account master key encrypted with Argon2id-derived key from passphrase';

-- Step 10: Log migration completion
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Netflix-style profiles migration completed successfully';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Accounts are now 1:1 with users';
  RAISE NOTICE '  - Created profiles for multi-user access';
  RAISE NOTICE '  - Simplified encryption to one key per account';
  RAISE NOTICE '  - Migrated watch history to profile-based';
  RAISE NOTICE '  - Removed account_members, member_keys, pending_invites tables';
END $$;
