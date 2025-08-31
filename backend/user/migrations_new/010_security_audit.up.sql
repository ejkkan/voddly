-- =====================================================
-- Security Audit System
-- Description: Security event logging and tracking
-- =====================================================

-- Security audit log for tracking sensitive operations
CREATE TABLE security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES "user"(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES user_subscription(id) ON DELETE SET NULL,
    
    -- Event details
    event_type VARCHAR(100) NOT NULL, -- 'passphrase_change', 'encryption_upgrade', 'device_added', etc.
    event_category VARCHAR(50) NOT NULL, -- 'security', 'access', 'modification'
    event_severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'critical'
    
    -- Context
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_id VARCHAR(255),
    
    -- Event data
    details JSONB, -- Event-specific data
    affected_resources JSONB, -- List of affected resources
    
    -- Result
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for security_audit_log
CREATE INDEX idx_audit_user ON security_audit_log(user_id);
CREATE INDEX idx_audit_subscription ON security_audit_log(subscription_id);
CREATE INDEX idx_audit_event_type ON security_audit_log(event_type);
CREATE INDEX idx_audit_category ON security_audit_log(event_category);
CREATE INDEX idx_audit_severity ON security_audit_log(event_severity);
CREATE INDEX idx_audit_created ON security_audit_log(created_at DESC);
CREATE INDEX idx_audit_device ON security_audit_log(device_id);

-- Comments
COMMENT ON TABLE security_audit_log IS 'Audit log for security-sensitive operations';
COMMENT ON COLUMN security_audit_log.event_type IS 'Specific event: passphrase_change, encryption_upgrade, etc.';
COMMENT ON COLUMN security_audit_log.event_category IS 'Category: security, access, modification';
COMMENT ON COLUMN security_audit_log.event_severity IS 'Severity level: info, warning, critical';
COMMENT ON COLUMN security_audit_log.details IS 'Event-specific data in JSON format';
COMMENT ON COLUMN security_audit_log.affected_resources IS 'List of resources affected by this event';