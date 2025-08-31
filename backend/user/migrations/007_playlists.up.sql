-- =====================================================
-- Custom Playlists
-- Description: User-created playlists for organizing content
-- =====================================================

-- Profile playlists
CREATE TABLE profile_playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Playlist details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    item_count INTEGER DEFAULT 0,
    cover_image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(profile_id, name)
);

-- Playlist items
CREATE TABLE playlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID NOT NULL REFERENCES profile_playlists(id) ON DELETE CASCADE,
    
    -- Content identification
    content_id TEXT NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('movie', 'episode', 'series', 'live')),
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
    
    -- Metadata (cached for display)
    title TEXT,
    poster_url TEXT,
    duration_seconds INTEGER,
    
    -- Order in playlist
    position INTEGER NOT NULL,
    
    -- Timestamps
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(playlist_id, position)
);

-- Indexes for profile_playlists
CREATE INDEX idx_playlists_profile ON profile_playlists(profile_id);
CREATE INDEX idx_playlists_public ON profile_playlists(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_playlists_created ON profile_playlists(created_at DESC);

-- Indexes for playlist_items
CREATE INDEX idx_playlist_items_playlist ON playlist_items(playlist_id);
CREATE INDEX idx_playlist_items_position ON playlist_items(playlist_id, position);
CREATE INDEX idx_playlist_items_source ON playlist_items(source_id);

-- Trigger for profile_playlists updated_at
CREATE TRIGGER update_profile_playlists_updated_at 
    BEFORE UPDATE ON profile_playlists 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column_snake();

-- Function to update playlist item count
CREATE OR REPLACE FUNCTION update_playlist_item_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'DELETE' THEN
        UPDATE profile_playlists
        SET item_count = (
            SELECT COUNT(*) FROM playlist_items WHERE playlist_id = COALESCE(NEW.playlist_id, OLD.playlist_id)
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = COALESCE(NEW.playlist_id, OLD.playlist_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to maintain item count
CREATE TRIGGER update_playlist_count_on_insert
    AFTER INSERT ON playlist_items
    FOR EACH ROW
    EXECUTE FUNCTION update_playlist_item_count();

CREATE TRIGGER update_playlist_count_on_delete
    AFTER DELETE ON playlist_items
    FOR EACH ROW
    EXECUTE FUNCTION update_playlist_item_count();

-- Comments
COMMENT ON TABLE profile_playlists IS 'Custom playlists created by profiles';
COMMENT ON COLUMN profile_playlists.is_public IS 'Whether the playlist can be shared with others';

COMMENT ON TABLE playlist_items IS 'Items in a playlist';
COMMENT ON COLUMN playlist_items.position IS 'Order of the item in the playlist (unique per playlist)';