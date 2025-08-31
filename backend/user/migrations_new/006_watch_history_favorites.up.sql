-- =====================================================
-- Watch History and Favorites
-- Description: Profile-based watch progress and favorites
-- =====================================================

-- Profile watch state and favorites
CREATE TABLE profile_watch_state (
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL,
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    
    -- Content identification
    content_type VARCHAR(20) CHECK (content_type IN ('movie', 'episode', 'live')),
    series_id TEXT, -- For episodes
    season_number INTEGER, -- For episodes
    episode_number INTEGER, -- For episodes
    
    -- Watch progress
    last_position_seconds INTEGER DEFAULT 0,
    total_duration_seconds INTEGER,
    completed BOOLEAN DEFAULT FALSE,
    watch_count INTEGER DEFAULT 1,
    
    -- Metadata
    is_favorite BOOLEAN DEFAULT FALSE,
    in_watchlist BOOLEAN DEFAULT FALSE,
    last_watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_to_watchlist_at TIMESTAMP,
    
    PRIMARY KEY (profile_id, content_id)
);

-- Profile favorites (simplified view for quick access)
CREATE TABLE profile_favorites (
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('movie', 'series', 'live')),
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    
    -- Metadata
    title TEXT,
    poster_url TEXT,
    backdrop_url TEXT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (profile_id, content_id)
);

-- Indexes for profile_watch_state
CREATE INDEX idx_watch_state_profile ON profile_watch_state(profile_id);
CREATE INDEX idx_watch_state_last_watched ON profile_watch_state(profile_id, last_watched_at DESC);
CREATE INDEX idx_watch_state_favorites ON profile_watch_state(profile_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_watch_state_watchlist ON profile_watch_state(profile_id, in_watchlist) WHERE in_watchlist = TRUE;
CREATE INDEX idx_watch_state_source ON profile_watch_state(source_id);
CREATE INDEX idx_watch_state_content_type ON profile_watch_state(content_type);

-- Indexes for profile_favorites
CREATE INDEX idx_favorites_profile ON profile_favorites(profile_id);
CREATE INDEX idx_favorites_added ON profile_favorites(profile_id, added_at DESC);
CREATE INDEX idx_favorites_source ON profile_favorites(source_id);
CREATE INDEX idx_favorites_content_type ON profile_favorites(content_type);

-- Comments
COMMENT ON TABLE profile_watch_state IS 'Watch history and progress per profile';
COMMENT ON COLUMN profile_watch_state.content_id IS 'Unique identifier for the content (from source)';
COMMENT ON COLUMN profile_watch_state.last_position_seconds IS 'Last watched position in seconds';
COMMENT ON COLUMN profile_watch_state.completed IS 'Whether the content was watched to completion';

COMMENT ON TABLE profile_favorites IS 'Quick access to favorite content per profile';
COMMENT ON COLUMN profile_favorites.content_id IS 'Unique identifier for the content (from source)';