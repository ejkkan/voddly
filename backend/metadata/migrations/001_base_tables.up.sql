-- Base tables for metadata service
-- Consolidated migration with final schema

-- Helper function for updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- 1. Content metadata table (from TMDB and other providers)
CREATE TABLE content_metadata (
    id SERIAL PRIMARY KEY,
    
    -- Provider information
    provider VARCHAR(50) NOT NULL, -- 'tmdb', 'imdb', 'tvdb', etc.
    provider_id VARCHAR(100) NOT NULL, -- ID from the provider
    
    -- Content identification
    content_type VARCHAR(20) NOT NULL, -- 'movie', 'tv', 'season', 'episode'
    title VARCHAR(500),
    original_title VARCHAR(500),
    overview TEXT,
    
    -- Common metadata
    release_date DATE,
    poster_path VARCHAR(500),
    backdrop_path VARCHAR(500),
    vote_average DECIMAL(3,1),
    vote_count INTEGER,
    popularity DECIMAL(10,3),
    original_language VARCHAR(10),
    genres JSONB,
    production_companies JSONB,
    runtime INTEGER, -- in minutes for movies/episodes
    status VARCHAR(50),
    tagline TEXT,
    
    -- TV Show specific fields
    number_of_seasons INTEGER,
    number_of_episodes INTEGER,
    first_air_date DATE,
    last_air_date DATE,
    episode_run_time JSONB, -- array of typical episode runtimes
    networks JSONB,
    created_by JSONB,
    
    -- Season specific fields
    season_number INTEGER,
    air_date DATE,
    
    -- Episode specific fields
    episode_number INTEGER,
    
    -- Parent references
    parent_provider_id VARCHAR(100), -- for seasons/episodes to reference their show
    
    -- External IDs for cross-referencing
    external_ids JSONB, -- {tmdb_id: 123, imdb_id: "tt123", tvdb_id: 456}
    
    -- Full raw response from the provider
    videos JSONB,
    images JSONB,
    "cast" JSONB,
    crew JSONB,
    keywords JSONB,
    raw_response JSONB,
    
    -- Timestamps
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint to prevent duplicates
    UNIQUE (provider, provider_id)
);

-- Indexes for content_metadata
CREATE INDEX idx_content_metadata_provider ON content_metadata(provider);
CREATE INDEX idx_content_metadata_content_type ON content_metadata(content_type);
CREATE INDEX idx_content_metadata_title ON content_metadata(title);
CREATE INDEX idx_content_metadata_fetched_at ON content_metadata(fetched_at);
CREATE INDEX idx_content_metadata_genres ON content_metadata USING GIN (genres);
CREATE INDEX idx_content_metadata_external_ids ON content_metadata USING GIN (external_ids);

-- Trigger for updated_at
CREATE TRIGGER update_content_metadata_updated_at
BEFORE UPDATE ON content_metadata
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Documentation
COMMENT ON TABLE content_metadata IS 'Cached metadata from various content providers';
COMMENT ON COLUMN content_metadata.content_type IS 'Type of content: movie, tv, season, or episode';
COMMENT ON COLUMN content_metadata.external_ids IS 'Cross-reference IDs from other providers';
COMMENT ON COLUMN content_metadata.parent_provider_id IS 'Reference to parent show for seasons and episodes';

-- 2. Subtitles table
CREATE TABLE IF NOT EXISTS subtitles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id TEXT NOT NULL,
  tmdb_id INTEGER,
  language_code TEXT NOT NULL,
  language_name TEXT NOT NULL,
  source TEXT NOT NULL,          -- 'opensubs', 'subdl', 'original', etc.
  source_id TEXT NOT NULL,       -- ID from the source provider
  content TEXT,                  -- NULL when only metadata is stored
  metadata JSONB,                -- Provider metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for subtitles
CREATE INDEX idx_subtitles_movie_id ON subtitles(movie_id);
CREATE INDEX idx_subtitles_tmdb_id ON subtitles(tmdb_id);
CREATE INDEX idx_subtitles_tmdb_lang ON subtitles(tmdb_id, language_code);
CREATE INDEX idx_subtitles_movie_lang ON subtitles(movie_id, language_code);
CREATE INDEX idx_subtitles_source ON subtitles(source);

-- Unique constraint to prevent duplicates per source per language
CREATE UNIQUE INDEX idx_subtitles_unique ON subtitles(movie_id, language_code, source);

-- Partial index for fast lookups that need content
CREATE INDEX idx_subtitles_with_content ON subtitles(movie_id, language_code)
WHERE content IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_subtitles_updated_at
BEFORE UPDATE ON subtitles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Documentation
COMMENT ON TABLE subtitles IS 'Subtitle metadata and cached content';
COMMENT ON COLUMN subtitles.source IS 'Subtitle provider: opensubs, subdl, original, etc.';
COMMENT ON COLUMN subtitles.source_id IS 'ID from the provider';
COMMENT ON COLUMN subtitles.content IS 'Cached SRT/VTT content (NULL when only metadata is stored)';
COMMENT ON COLUMN subtitles.metadata IS 'Original provider metadata payload';
