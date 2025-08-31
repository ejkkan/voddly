-- Account devices table for device-specific encryption settings
CREATE TABLE IF NOT EXISTS account_devices (
    id SERIAL PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) NOT NULL, -- 'ios', 'tvos', 'android', 'web'
    device_name VARCHAR(255), -- User-friendly name like "Erik's iPhone"
    device_model VARCHAR(255), -- Device model for debugging
    
    -- Device-specific encryption parameters
    kdf_iterations INTEGER NOT NULL DEFAULT 100000,
    master_key_wrapped TEXT NOT NULL, -- Device-specific encrypted master key
    salt VARCHAR(255) NOT NULL, -- Device-specific salt
    iv VARCHAR(255) NOT NULL, -- Device-specific IV
    
    -- Optional server-side wrapping (for double encryption)
    server_wrapped_key TEXT,
    server_iv VARCHAR(255),
    
    -- Metadata
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique device per account
    UNIQUE(account_id, device_id)
);

-- Index for faster lookups
CREATE INDEX idx_account_devices_account_id ON account_devices(account_id);
CREATE INDEX idx_account_devices_device_id ON account_devices(device_id);
CREATE INDEX idx_account_devices_last_used ON account_devices(last_used);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_account_devices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER account_devices_updated_at
    BEFORE UPDATE ON account_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_account_devices_updated_at();