-- Clean Source Architecture Migration
-- Removes legacy tables and creates new zero-knowledge structure

-- Drop legacy tables
DROP TABLE IF EXISTS user_playlists CASCADE;
DROP TABLE IF EXISTS app_account_key_wrap CASCADE;

-- Drop app_account_secret as we'll merge it into sources
DROP TABLE IF EXISTS app_account_secret CASCADE;

-- Drop and recreate app_account_source as sources with merged encryption
DROP TABLE IF EXISTS app_account_source CASCADE;

-- Rename existing tables to cleaner names (only if they exist)
DO $$ 
BEGIN
  -- Rename app_account to accounts if it exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_account') THEN
    ALTER TABLE app_account RENAME TO accounts;
  END IF;
  
  -- Rename app_account_member to account_members if it exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_account_member') THEN
    ALTER TABLE app_account_member RENAME TO account_members;
  END IF;
  
  -- Rename user_content_state to member_watch_state if it exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_content_state') THEN
    ALTER TABLE user_content_state RENAME TO member_watch_state;
  END IF;
END $$;

-- Create accounts table if it doesn't exist
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id VARCHAR(255) REFERENCES "user"(id),
  name TEXT,
  plan TEXT,
  status TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create account_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS account_members (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, user_id)
);

-- Create member_watch_state table if it doesn't exist
CREATE TABLE IF NOT EXISTS member_watch_state (
  user_id VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_type TEXT,
  last_position_seconds INT,
  total_duration_seconds INT,
  is_favorite BOOLEAN DEFAULT false,
  last_watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, content_id)
);

-- Create clean sources table with encryption built-in
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('xtream', 'm3u', 'plex', 'jellyfin')),
  encrypted_config TEXT NOT NULL,  -- Encrypted credentials blob
  config_iv TEXT NOT NULL,          -- IV for decryption
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sources_account ON sources(account_id);
CREATE INDEX idx_sources_active ON sources(account_id, is_active) WHERE is_active = true;

-- Create member_keys table for key wrapping
CREATE TABLE IF NOT EXISTS member_keys (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  wrapped_master_key TEXT NOT NULL,  -- Account master key encrypted with member's passphrase
  salt TEXT NOT NULL,                -- Salt for PBKDF2 key derivation
  iv TEXT NOT NULL,                  -- IV for encryption
  iterations INT NOT NULL DEFAULT 500000,  -- High iteration count for 6-char passphrases
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, user_id)
);

CREATE INDEX idx_member_keys_user ON member_keys(user_id);

-- Update member_watch_state structure
DO $$
BEGIN
  -- Add source_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'member_watch_state' 
                AND column_name = 'source_id') THEN
    ALTER TABLE member_watch_state ADD COLUMN source_id UUID REFERENCES sources(id) ON DELETE CASCADE;
  END IF;
  
  -- Add content_type column if it doesn't exist (might already be there)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'member_watch_state' 
                AND column_name = 'content_type') THEN
    ALTER TABLE member_watch_state ADD COLUMN content_type TEXT;
  END IF;
  
  -- Add total_duration_seconds column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'member_watch_state' 
                AND column_name = 'total_duration_seconds') THEN
    ALTER TABLE member_watch_state ADD COLUMN total_duration_seconds INT;
  END IF;
  
  -- Rename content_key to content_id if content_key exists
  IF EXISTS (SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'member_watch_state' 
            AND column_name = 'content_key') THEN
    ALTER TABLE member_watch_state RENAME COLUMN content_key TO content_id;
  END IF;
  
  -- Update last_seen_at to last_watched_at if last_seen_at exists
  IF EXISTS (SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'member_watch_state' 
            AND column_name = 'last_seen_at') THEN
    ALTER TABLE member_watch_state RENAME COLUMN last_seen_at TO last_watched_at;
  END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_watch_state_source ON member_watch_state(user_id, source_id);
CREATE INDEX IF NOT EXISTS idx_watch_state_favorites ON member_watch_state(user_id, source_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_watch_state_recent ON member_watch_state(user_id, last_watched_at DESC);

-- Create pending invites table for member invitations
CREATE TABLE IF NOT EXISTS pending_invites (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  inviter_user_id VARCHAR(255) NOT NULL REFERENCES "user"(id),
  invitee_email VARCHAR(255) NOT NULL,
  encrypted_master_key TEXT NOT NULL,  -- Master key encrypted with temp key
  temp_key_hash TEXT NOT NULL,         -- Hash to verify temp key from URL
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invites_email ON pending_invites(invitee_email);
CREATE INDEX idx_invites_expires ON pending_invites(expires_at) WHERE used_at IS NULL;

-- Add comments for documentation
COMMENT ON TABLE accounts IS 'User accounts for billing and ownership';
COMMENT ON TABLE account_members IS 'Members who have access to an account';
COMMENT ON TABLE member_keys IS 'Each member''s encrypted access key to the account';
COMMENT ON TABLE sources IS 'Encrypted content sources (IPTV, Plex, etc)';
COMMENT ON TABLE member_watch_state IS 'Per-user watch progress and favorites';
COMMENT ON TABLE pending_invites IS 'Temporary tokens for inviting new members';

COMMENT ON COLUMN sources.encrypted_config IS 'Client-encrypted credentials - server cannot decrypt';
COMMENT ON COLUMN member_keys.wrapped_master_key IS 'Account master key encrypted with member''s passphrase';
COMMENT ON COLUMN member_keys.iterations IS 'PBKDF2 iterations - 500k for 6-char passphrases';