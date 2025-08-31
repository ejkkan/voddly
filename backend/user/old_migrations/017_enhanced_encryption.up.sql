-- =====================================================
-- ENHANCED ENCRYPTION MIGRATION
-- Description: Adds support for stronger encryption with iteration tracking
-- Changes:
--   - Add kdf_iterations to track PBKDF2 iteration count
--   - Add server-side encryption columns
--   - Add encryption version tracking
-- =====================================================

-- Step 1: Add enhanced encryption columns to account_encryption
-- All new accounts use 500k iterations and server-side encryption
ALTER TABLE account_encryption 
  ADD COLUMN IF NOT EXISTS kdf_iterations INTEGER DEFAULT 500000,
  ADD COLUMN IF NOT EXISTS server_wrapped_key TEXT,
  ADD COLUMN IF NOT EXISTS server_iv TEXT;

-- Step 2: Add encryption columns to watch state for future use
ALTER TABLE profile_watch_state
  ADD COLUMN IF NOT EXISTS encrypted_data TEXT,
  ADD COLUMN IF NOT EXISTS encryption_iv TEXT,
  ADD COLUMN IF NOT EXISTS content_id_hash TEXT;

-- Create index for encrypted content lookups
CREATE INDEX IF NOT EXISTS idx_watch_state_content_hash 
  ON profile_watch_state(profile_id, content_id_hash) 
  WHERE content_id_hash IS NOT NULL;

-- Step 3: Set default iteration count for any existing records
-- New system requires 500k iterations
UPDATE account_encryption 
SET kdf_iterations = 500000 
WHERE kdf_iterations IS NULL;

-- Step 4: Add audit log table for security events
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'key_derivation', 'decrypt_attempt', 'password_change', etc.
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  error_message TEXT,
  duration_ms INTEGER, -- Track how long operations take
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_account 
  ON security_audit_log(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_action 
  ON security_audit_log(action, created_at DESC);

-- Step 5: Add comment documentation
COMMENT ON COLUMN account_encryption.kdf_iterations IS 
  'Number of PBKDF2 iterations used for key derivation. Always 500000 for enhanced security';

COMMENT ON COLUMN account_encryption.server_wrapped_key IS 
  'Master key double-wrapped with server secret for additional protection (required)';

COMMENT ON TABLE security_audit_log IS 
  'Audit trail for security-related events including decryption attempts and key operations';