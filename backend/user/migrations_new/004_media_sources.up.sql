-- =====================================================
-- Media Sources Management
-- Description: IPTV and media source configuration
-- =====================================================

-- Sources table for IPTV/media sources
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES user_subscription(id) ON DELETE CASCADE,
    
    -- Source identification
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('xtream', 'm3u', 'stalker', 'webdav')),
    
    -- Connection details (stored encrypted in source_credentials table)
    -- server_url, username, password are stored in source_credentials
    
    -- Additional config
    epg_url TEXT,
    user_agent TEXT,
    http_referer TEXT,
    
    -- Status and metadata
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'syncing', 'success', 'error'
    sync_error TEXT,
    
    -- Content counts
    total_channels INTEGER DEFAULT 0,
    total_movies INTEGER DEFAULT 0,
    total_series INTEGER DEFAULT 0,
    total_categories INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Profile source restrictions (for parental controls)
CREATE TABLE profile_sources (
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, source_id)
);

-- Indexes for sources
CREATE INDEX idx_sources_subscription ON sources(subscription_id);
CREATE INDEX idx_sources_active ON sources(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_sources_sync_status ON sources(sync_status);
CREATE INDEX idx_sources_type ON sources(source_type);

-- Indexes for profile_sources
CREATE INDEX idx_profile_sources_profile ON profile_sources(profile_id);
CREATE INDEX idx_profile_sources_source ON profile_sources(source_id);

-- Trigger for sources updated_at
CREATE TRIGGER update_sources_updated_at 
    BEFORE UPDATE ON sources 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE sources IS 'Media sources (IPTV, etc.) attached to a subscription';
COMMENT ON COLUMN sources.source_type IS 'Type of source: xtream, m3u, stalker, webdav';
COMMENT ON COLUMN sources.sync_status IS 'Current sync status: pending, syncing, success, error';

COMMENT ON TABLE profile_sources IS 'Source restrictions per profile for parental controls';