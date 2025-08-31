-- =====================================================
-- Device Management
-- Description: Track and manage devices per subscription
-- =====================================================

-- Subscription devices
CREATE TABLE subscription_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES user_subscription(id) ON DELETE CASCADE,
    
    -- Device identification
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50) CHECK (device_type IN ('mobile', 'tablet', 'tv', 'web', 'desktop')),
    
    -- Device details
    platform VARCHAR(100),
    os_version VARCHAR(50),
    app_version VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_trusted BOOLEAN DEFAULT FALSE,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_online BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(subscription_id, device_id)
);

-- Device sessions (track active sessions per device)
CREATE TABLE device_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES subscription_devices(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- Session details
    session_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
);

-- Indexes for subscription_devices
CREATE INDEX idx_devices_subscription ON subscription_devices(subscription_id);
CREATE INDEX idx_devices_active ON subscription_devices(subscription_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_devices_device_id ON subscription_devices(device_id);
CREATE INDEX idx_devices_online ON subscription_devices(subscription_id, is_online) WHERE is_online = TRUE;
CREATE INDEX idx_devices_last_active ON subscription_devices(last_active_at DESC);

-- Indexes for device_sessions
CREATE INDEX idx_device_sessions_device ON device_sessions(device_id);
CREATE INDEX idx_device_sessions_profile ON device_sessions(profile_id);
CREATE INDEX idx_device_sessions_token ON device_sessions(session_token);
CREATE INDEX idx_device_sessions_active ON device_sessions(is_active) WHERE is_active = TRUE;

-- Trigger for subscription_devices updated_at
CREATE TRIGGER update_subscription_devices_updated_at 
    BEFORE UPDATE ON subscription_devices 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to check device limits
CREATE OR REPLACE FUNCTION check_device_limit()
RETURNS TRIGGER AS $$
DECLARE
    active_count INTEGER;
    max_devices INTEGER;
    tier VARCHAR(50);
BEGIN
    -- Get subscription tier
    SELECT subscription_tier INTO tier
    FROM user_subscription
    WHERE id = NEW.subscription_id;
    
    -- Determine device limit based on tier
    max_devices := CASE tier
        WHEN 'basic' THEN 2
        WHEN 'standard' THEN 4
        WHEN 'premium' THEN 6
        ELSE 2
    END;
    
    -- Count active devices
    SELECT COUNT(*) INTO active_count
    FROM subscription_devices
    WHERE subscription_id = NEW.subscription_id
      AND is_active = TRUE
      AND id != COALESCE(NEW.id, gen_random_uuid());
    
    -- Check limit
    IF NEW.is_active = TRUE AND active_count >= max_devices THEN
        RAISE EXCEPTION 'Device limit reached for subscription tier %', tier;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce device limits
CREATE TRIGGER enforce_device_limit
    BEFORE INSERT OR UPDATE ON subscription_devices
    FOR EACH ROW
    EXECUTE FUNCTION check_device_limit();

-- Comments
COMMENT ON TABLE subscription_devices IS 'Registered devices per subscription';
COMMENT ON COLUMN subscription_devices.device_id IS 'Unique device identifier (fingerprint)';
COMMENT ON COLUMN subscription_devices.is_trusted IS 'Whether the device is trusted (skip 2FA, etc.)';

COMMENT ON TABLE device_sessions IS 'Active sessions per device';
COMMENT ON COLUMN device_sessions.profile_id IS 'Which profile is being used in this session';