-- Migration to hybrid encryption with KMS support
-- This adds support for dual-key encryption where DEK is protected by both KMS and user passphrase

-- Add new columns to account_encryption for hybrid encryption
ALTER TABLE account_encryption 
  ADD COLUMN IF NOT EXISTS dek_encrypted_by_smk TEXT,      -- DEK encrypted by Server Master Key (KMS)
  ADD COLUMN IF NOT EXISTS dek_encrypted_by_kek TEXT,      -- DEK encrypted by Key Encryption Key (user passphrase)
  ADD COLUMN IF NOT EXISTS kek_salt TEXT,                  -- Salt for deriving KEK from passphrase
  ADD COLUMN IF NOT EXISTS kek_iv TEXT,                    -- IV for KEK encryption
  ADD COLUMN IF NOT EXISTS kms_key_id TEXT,                -- KMS key identifier used
  ADD COLUMN IF NOT EXISTS kdf_algorithm TEXT DEFAULT 'pbkdf2',  -- Key derivation function
  ADD COLUMN IF NOT EXISTS kdf_params JSONB,               -- KDF parameters (iterations, memory, etc.)
  ADD COLUMN IF NOT EXISTS encryption_version INT DEFAULT 1,      -- Track encryption scheme version
  ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMP;          -- When migrated to new scheme

-- Create audit log table for encryption operations
CREATE TABLE IF NOT EXISTS encryption_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES "user"(id),
  operation VARCHAR(50) NOT NULL CHECK (operation IN ('encrypt', 'decrypt', 'rekey', 'migrate')),
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit log
CREATE INDEX idx_audit_user_timestamp ON encryption_audit_log(user_id, timestamp DESC);
CREATE INDEX idx_audit_operation ON encryption_audit_log(operation, timestamp DESC);
CREATE INDEX idx_audit_failures ON encryption_audit_log(success, timestamp DESC) WHERE success = false;

-- Create table for tracking failed decryption attempts (for rate limiting)
CREATE TABLE IF NOT EXISTS decryption_attempts (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  attempt_count INT NOT NULL DEFAULT 0,
  last_attempt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_until TIMESTAMP,
  PRIMARY KEY (account_id)
);

-- Create index for finding locked accounts
CREATE INDEX idx_locked_accounts ON decryption_attempts(locked_until) WHERE locked_until > CURRENT_TIMESTAMP;

-- Add comments explaining the new encryption scheme
COMMENT ON COLUMN account_encryption.dek_encrypted_by_smk IS 'Data Encryption Key encrypted by Server Master Key in KMS - provides server-side protection';
COMMENT ON COLUMN account_encryption.dek_encrypted_by_kek IS 'Data Encryption Key encrypted by user passphrase-derived Key Encryption Key - provides user-controlled protection';
COMMENT ON COLUMN account_encryption.kek_salt IS 'Salt for deriving KEK from user passphrase using KDF';
COMMENT ON COLUMN account_encryption.kdf_algorithm IS 'Key derivation function: pbkdf2 (legacy) or argon2id (recommended)';
COMMENT ON COLUMN account_encryption.kdf_params IS 'KDF parameters: iterations, memory cost, parallelism, etc.';
COMMENT ON COLUMN account_encryption.encryption_version IS 'Version 1: original, Version 2: hybrid KMS+passphrase';

-- Function to check if account is locked due to failed attempts
CREATE OR REPLACE FUNCTION is_account_locked(p_account_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_locked_until TIMESTAMP;
BEGIN
  SELECT locked_until INTO v_locked_until
  FROM decryption_attempts
  WHERE account_id = p_account_id;
  
  RETURN v_locked_until IS NOT NULL AND v_locked_until > CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to record failed decryption attempt with exponential backoff
CREATE OR REPLACE FUNCTION record_failed_decryption(p_account_id UUID)
RETURNS void AS $$
DECLARE
  v_attempt_count INT;
  v_lockout_minutes INT;
BEGIN
  -- Get current attempt count
  SELECT attempt_count INTO v_attempt_count
  FROM decryption_attempts
  WHERE account_id = p_account_id;
  
  IF v_attempt_count IS NULL THEN
    v_attempt_count := 0;
  END IF;
  
  v_attempt_count := v_attempt_count + 1;
  
  -- Calculate lockout time with exponential backoff
  -- 3 attempts: no lock
  -- 4 attempts: 1 minute
  -- 5 attempts: 5 minutes
  -- 6 attempts: 15 minutes
  -- 7+ attempts: 60 minutes
  v_lockout_minutes := CASE
    WHEN v_attempt_count <= 3 THEN 0
    WHEN v_attempt_count = 4 THEN 1
    WHEN v_attempt_count = 5 THEN 5
    WHEN v_attempt_count = 6 THEN 15
    ELSE 60
  END;
  
  -- Update or insert attempt record
  INSERT INTO decryption_attempts (account_id, attempt_count, last_attempt, locked_until)
  VALUES (
    p_account_id,
    v_attempt_count,
    CURRENT_TIMESTAMP,
    CASE 
      WHEN v_lockout_minutes > 0 THEN CURRENT_TIMESTAMP + (v_lockout_minutes || ' minutes')::INTERVAL
      ELSE NULL
    END
  )
  ON CONFLICT (account_id) DO UPDATE SET
    attempt_count = v_attempt_count,
    last_attempt = CURRENT_TIMESTAMP,
    locked_until = CASE 
      WHEN v_lockout_minutes > 0 THEN CURRENT_TIMESTAMP + (v_lockout_minutes || ' minutes')::INTERVAL
      ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to clear failed attempts after successful decryption
CREATE OR REPLACE FUNCTION clear_failed_attempts(p_account_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM decryption_attempts WHERE account_id = p_account_id;
END;
$$ LANGUAGE plpgsql;