-- =====================================================
-- Watch History and Favorites
-- Description: Profile-based watch progress and favorites
-- =====================================================

-- Profile watch state and favorites
CREATE TABLE profile_watch_state (
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL, -- Format: {uuid}:{type}:{id}
    content_type VARCHAR(20) CHECK (content_type IN ('movie', 'episode', 'live', 'series', 'tv')),
    
    -- Watch progress
    last_position_seconds INTEGER DEFAULT 0,
    total_duration_seconds INTEGER,
    watch_count INTEGER DEFAULT 1,
    
    -- Timestamps
    first_watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP, -- Set when content is finished
    
    -- Player preferences
    playback_speed DECIMAL(3,2) DEFAULT 1.0,
    audio_track TEXT, -- Last selected audio language/track
    subtitle_track TEXT, -- Last selected subtitle language
    quality_preference TEXT, -- Last selected quality
    
    -- Skip markers (in seconds)
    skip_intro_start INTEGER,
    skip_intro_end INTEGER,
    skip_outro_start INTEGER,
    
    PRIMARY KEY (profile_id, content_id)
);

-- Profile favorites (simplified view for quick access)
CREATE TABLE profile_favorites (
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('movie', 'series', 'tv', 'category', 'channel')),
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (profile_id, content_id)
);

-- Indexes for profile_watch_state
CREATE INDEX idx_watch_state_profile_last_watched ON profile_watch_state(profile_id, last_watched_at DESC);
CREATE INDEX idx_watch_state_profile_first_watched ON profile_watch_state(profile_id, first_watched_at DESC);
CREATE INDEX idx_watch_state_content_type ON profile_watch_state(content_type) WHERE content_type IS NOT NULL;
CREATE INDEX idx_watch_state_completed ON profile_watch_state(profile_id, completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_watch_state_in_progress ON profile_watch_state(profile_id, last_watched_at DESC) 
    WHERE completed_at IS NULL AND last_position_seconds > 0;

-- Indexes for profile_favorites
CREATE INDEX idx_favorites_profile ON profile_favorites(profile_id);
CREATE INDEX idx_favorites_added ON profile_favorites(profile_id, added_at DESC);
CREATE INDEX idx_favorites_source ON profile_favorites(source_id);
CREATE INDEX idx_favorites_content_type ON profile_favorites(content_type);

-- Comments
COMMENT ON TABLE profile_watch_state IS 'Playback tracking and user preferences per profile';
COMMENT ON COLUMN profile_watch_state.content_id IS 'Content identifier in format {uuid}:{type}:{id}';
COMMENT ON COLUMN profile_watch_state.last_position_seconds IS 'Last watched position in seconds';
COMMENT ON COLUMN profile_watch_state.completed_at IS 'Timestamp when content was watched to completion';
COMMENT ON COLUMN profile_watch_state.first_watched_at IS 'When user first started watching this content';
COMMENT ON COLUMN profile_watch_state.playback_speed IS 'User preferred playback speed for this content';
COMMENT ON COLUMN profile_watch_state.skip_intro_start IS 'Start time in seconds for intro skip';
COMMENT ON COLUMN profile_watch_state.skip_intro_end IS 'End time in seconds for intro skip';
COMMENT ON COLUMN profile_watch_state.skip_outro_start IS 'Start time in seconds for outro/credits skip';

COMMENT ON TABLE profile_favorites IS 'Quick access to favorite content per profile';
COMMENT ON COLUMN profile_favorites.content_id IS 'Unique identifier for the content (from source)';