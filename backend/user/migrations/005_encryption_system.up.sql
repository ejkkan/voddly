-- =====================================================
-- Encryption System
-- Description: Passphrase-based encryption for sensitive data
-- =====================================================

-- Subscription encryption keys
CREATE TABLE subscription_encryption (
    subscription_id UUID PRIMARY KEY REFERENCES user_subscription(id) ON DELETE CASCADE,
    
    -- Master key (encrypted with passphrase-derived key)
    master_key_wrapped TEXT NOT NULL,
    
    -- Server-side encryption for additional protection
    server_wrapped_key TEXT,
    server_iv TEXT,
    
    -- Key derivation parameters
    salt TEXT NOT NULL,
    iv TEXT NOT NULL,
    
    -- KDF settings (for passphrase key derivation)
    kdf_algorithm VARCHAR(50) DEFAULT 'pbkdf2',
    kdf_iterations INTEGER DEFAULT 500000,
    kdf_memory INTEGER DEFAULT 65536,  -- 64MB (for future Argon2 support)
    kdf_parallelism INTEGER DEFAULT 4,  -- (for future Argon2 support)
    
    -- Enhanced encryption support
    encryption_version INTEGER DEFAULT 2,
    needs_upgrade BOOLEAN DEFAULT FALSE,
    last_upgraded_at TIMESTAMP,
    upgrade_failed_at TIMESTAMP,
    upgrade_error TEXT,
    
    -- Device-specific parameters (optional)
    device_specific_params JSONB, -- {device_id: {salt, iterations, memory}}
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Source credentials (stores encrypted credentials)
CREATE TABLE source_credentials (
    source_id UUID PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
    
    -- Encrypted credentials
    encrypted_config TEXT NOT NULL, -- JSON with server, username, password
    config_iv TEXT NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_subscription_encryption_subscription ON subscription_encryption(subscription_id);
CREATE INDEX idx_source_credentials_source ON source_credentials(source_id);

-- Triggers for updated_at
CREATE TRIGGER update_subscription_encryption_updated_at 
    BEFORE UPDATE ON subscription_encryption 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column_snake();

CREATE TRIGGER update_source_credentials_updated_at 
    BEFORE UPDATE ON source_credentials 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column_snake();

-- Comments
COMMENT ON TABLE subscription_encryption IS 'Encryption keys for each subscription';
COMMENT ON COLUMN subscription_encryption.master_key_wrapped IS 'Master key encrypted with PBKDF2-derived key from passphrase';
COMMENT ON COLUMN subscription_encryption.server_wrapped_key IS 'Master key double-wrapped with server secret for additional protection';
COMMENT ON COLUMN subscription_encryption.server_iv IS 'Initialization vector for server-side encryption';
COMMENT ON COLUMN subscription_encryption.kdf_algorithm IS 'Key derivation function algorithm (pbkdf2)';
COMMENT ON COLUMN subscription_encryption.kdf_iterations IS 'Number of PBKDF2 iterations (500000 for enhanced security)';
COMMENT ON COLUMN subscription_encryption.kdf_memory IS 'Memory parameter for future Argon2 support in KB';
COMMENT ON COLUMN subscription_encryption.kdf_parallelism IS 'Parallelism parameter for future Argon2 support';

COMMENT ON TABLE source_credentials IS 'Encrypted credentials for media sources';
COMMENT ON COLUMN source_credentials.encrypted_config IS 'AES-256-GCM encrypted JSON with credentials';