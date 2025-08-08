-- User Playlists Migration
-- Adds table for storing user IPTV playlist configurations

CREATE TABLE user_playlists (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    
    -- Playlist details
    name VARCHAR(255) NOT NULL,
    server VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    
    -- Status and metadata
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP,
    sync_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'syncing', 'success', 'error'
    sync_error TEXT,
    
    -- Counts (updated when syncing)
    total_channels INTEGER DEFAULT 0,
    total_categories INTEGER DEFAULT 0,
    total_vod INTEGER DEFAULT 0,
    total_series INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for user_playlists
CREATE INDEX idx_user_playlists_user_id ON user_playlists (user_id);
CREATE INDEX idx_user_playlists_active ON user_playlists (is_active) WHERE is_active = true;
CREATE INDEX idx_user_playlists_sync_status ON user_playlists (sync_status);

-- Note: updated_at is handled manually in queries, no trigger needed

-- Add comments
COMMENT ON TABLE user_playlists IS 'Stores user IPTV playlist configurations and sync status';
COMMENT ON COLUMN user_playlists.user_id IS 'Reference to the user who owns this playlist';
COMMENT ON COLUMN user_playlists.name IS 'User-friendly name for the playlist';
COMMENT ON COLUMN user_playlists.server IS 'IPTV server URL';
COMMENT ON COLUMN user_playlists.username IS 'IPTV server username';
COMMENT ON COLUMN user_playlists.password IS 'IPTV server password';
COMMENT ON COLUMN user_playlists.sync_status IS 'Current sync status: pending, syncing, success, error';
COMMENT ON COLUMN user_playlists.last_sync_at IS 'Timestamp of last successful sync';
COMMENT ON COLUMN user_playlists.sync_error IS 'Error message if sync failed';