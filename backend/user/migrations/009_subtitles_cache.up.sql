-- =====================================================
-- Subtitles Cache
-- Description: Cache subtitles fetched from various providers
-- =====================================================

-- User-specific subtitle cache
CREATE TABLE user_subtitles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Content identification
    movie_id TEXT NOT NULL,
    tmdb_id INTEGER,
    imdb_id VARCHAR(20),
    
    -- Language
    language_code VARCHAR(10) NOT NULL,
    language_name VARCHAR(100),
    
    -- Source information
    source VARCHAR(50) NOT NULL, -- 'opensubs', 'subdl', 'embedded', 'user_upload'
    source_id TEXT, -- ID from the source provider
    
    -- Content
    content TEXT, -- SRT/VTT content
    content_format VARCHAR(10) DEFAULT 'srt', -- 'srt', 'vtt', 'ass'
    
    -- Quality metrics
    download_count INTEGER,
    rating DECIMAL(3,2),
    is_hearing_impaired BOOLEAN DEFAULT FALSE,
    is_forced BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    release_name TEXT,
    uploader VARCHAR(255),
    fps DECIMAL(5,2),
    metadata JSONB, -- Additional provider-specific metadata
    
    -- User association (optional, for user uploads)
    uploaded_by_user_id VARCHAR(255) REFERENCES "user"(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Profile subtitle preferences
CREATE TABLE profile_subtitle_preferences (
    profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Default preferences
    enabled_by_default BOOLEAN DEFAULT FALSE,
    preferred_languages TEXT[], -- Array of language codes in order of preference
    
    -- Display preferences
    font_size VARCHAR(20) DEFAULT 'medium',
    font_color VARCHAR(7) DEFAULT '#FFFFFF',
    background_color VARCHAR(7) DEFAULT '#000000',
    background_opacity DECIMAL(3,2) DEFAULT 0.75,
    
    -- Source preferences
    preferred_sources TEXT[], -- Array of sources in order of preference
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for user_subtitles
CREATE INDEX idx_user_subtitles_movie ON user_subtitles(movie_id);
CREATE INDEX idx_user_subtitles_tmdb ON user_subtitles(tmdb_id) WHERE tmdb_id IS NOT NULL;
CREATE INDEX idx_user_subtitles_imdb ON user_subtitles(imdb_id) WHERE imdb_id IS NOT NULL;
CREATE INDEX idx_user_subtitles_language ON user_subtitles(language_code);
CREATE INDEX idx_user_subtitles_source ON user_subtitles(source);
CREATE INDEX idx_user_subtitles_movie_lang ON user_subtitles(movie_id, language_code);

-- Unique constraint to prevent duplicate subtitles
CREATE UNIQUE INDEX idx_user_subtitles_unique ON user_subtitles(movie_id, language_code, source, COALESCE(source_id, ''));

-- Partial index for subtitles with content
CREATE INDEX idx_user_subtitles_with_content ON user_subtitles(movie_id, language_code)
WHERE content IS NOT NULL;

-- Triggers for updated_at
CREATE TRIGGER update_user_subtitles_updated_at 
    BEFORE UPDATE ON user_subtitles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column_snake();

CREATE TRIGGER update_profile_subtitle_preferences_updated_at 
    BEFORE UPDATE ON profile_subtitle_preferences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column_snake();

-- Comments
COMMENT ON TABLE user_subtitles IS 'Cached subtitles from various providers';
COMMENT ON COLUMN user_subtitles.source IS 'Provider: opensubs, subdl, embedded, user_upload';
COMMENT ON COLUMN user_subtitles.content IS 'Cached subtitle content in SRT/VTT format';

COMMENT ON TABLE profile_subtitle_preferences IS 'Subtitle display preferences per profile';
COMMENT ON COLUMN profile_subtitle_preferences.preferred_languages IS 'Language codes in order of preference';