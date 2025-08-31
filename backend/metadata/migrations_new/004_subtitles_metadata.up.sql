-- =====================================================
-- Subtitles Metadata
-- Description: Global subtitle metadata cache
-- =====================================================

-- Global subtitles metadata cache
CREATE TABLE subtitles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Content identification
    movie_id TEXT NOT NULL, -- ID from IPTV/source
    tmdb_id INTEGER,
    imdb_id VARCHAR(20),
    
    -- Language
    language_code VARCHAR(10) NOT NULL,
    language_name VARCHAR(100) NOT NULL,
    
    -- Source information
    source VARCHAR(50) NOT NULL, -- 'opensubs', 'subdl', 'embedded', 'original'
    source_id TEXT NOT NULL, -- ID from the source provider
    
    -- Content (optional - can be metadata only)
    content TEXT, -- SRT/VTT content (NULL when only metadata is stored)
    content_format VARCHAR(10) DEFAULT 'srt', -- 'srt', 'vtt', 'ass'
    
    -- Quality metrics
    download_count INTEGER,
    rating DECIMAL(3,2),
    is_hearing_impaired BOOLEAN DEFAULT FALSE,
    is_forced BOOLEAN DEFAULT FALSE,
    is_machine_translated BOOLEAN DEFAULT FALSE,
    
    -- File information
    file_name TEXT,
    file_size INTEGER, -- in bytes
    fps DECIMAL(5,2),
    release_name TEXT,
    uploader VARCHAR(255),
    
    -- Provider metadata
    metadata JSONB, -- Original provider response/metadata
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subtitle provider status (track API limits and availability)
CREATE TABLE subtitle_provider_status (
    provider VARCHAR(50) PRIMARY KEY,
    
    -- Status
    is_available BOOLEAN DEFAULT TRUE,
    last_error TEXT,
    last_error_at TIMESTAMP,
    
    -- Rate limiting
    requests_today INTEGER DEFAULT 0,
    daily_limit INTEGER,
    reset_at TIMESTAMP,
    
    -- Statistics
    total_requests BIGINT DEFAULT 0,
    total_downloads BIGINT DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for subtitles
CREATE INDEX idx_subtitles_movie_id ON subtitles(movie_id);
CREATE INDEX idx_subtitles_tmdb_id ON subtitles(tmdb_id) WHERE tmdb_id IS NOT NULL;
CREATE INDEX idx_subtitles_imdb_id ON subtitles(imdb_id) WHERE imdb_id IS NOT NULL;
CREATE INDEX idx_subtitles_language ON subtitles(language_code);
CREATE INDEX idx_subtitles_source ON subtitles(source);
CREATE INDEX idx_subtitles_movie_lang ON subtitles(movie_id, language_code);
CREATE INDEX idx_subtitles_tmdb_lang ON subtitles(tmdb_id, language_code) WHERE tmdb_id IS NOT NULL;
CREATE INDEX idx_subtitles_rating ON subtitles(rating DESC) WHERE rating IS NOT NULL;

-- Unique constraint to prevent duplicate subtitles per source
CREATE UNIQUE INDEX idx_subtitles_unique ON subtitles(movie_id, language_code, source, source_id);

-- Partial index for subtitles with actual content
CREATE INDEX idx_subtitles_with_content ON subtitles(movie_id, language_code)
WHERE content IS NOT NULL;

-- Triggers for updated_at
CREATE TRIGGER update_subtitles_updated_at
BEFORE UPDATE ON subtitles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subtitle_provider_status_updated_at
BEFORE UPDATE ON subtitle_provider_status
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to track subtitle access
CREATE OR REPLACE FUNCTION track_subtitle_access()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_accessed_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_accessed_at when content is retrieved
CREATE TRIGGER track_subtitle_access_trigger
BEFORE UPDATE ON subtitles
FOR EACH ROW
WHEN (OLD.content IS DISTINCT FROM NEW.content AND NEW.content IS NOT NULL)
EXECUTE FUNCTION track_subtitle_access();

-- Comments
COMMENT ON TABLE subtitles IS 'Global subtitle metadata and content cache';
COMMENT ON COLUMN subtitles.source IS 'Subtitle provider: opensubs, subdl, embedded, original';
COMMENT ON COLUMN subtitles.source_id IS 'Unique ID from the provider';
COMMENT ON COLUMN subtitles.content IS 'Cached SRT/VTT content (NULL for metadata-only entries)';
COMMENT ON COLUMN subtitles.metadata IS 'Original provider metadata/response';

COMMENT ON TABLE subtitle_provider_status IS 'Track subtitle provider availability and limits';
COMMENT ON COLUMN subtitle_provider_status.daily_limit IS 'API daily request limit';
COMMENT ON COLUMN subtitle_provider_status.reset_at IS 'When the daily counter resets';