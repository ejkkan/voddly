-- Create table for content metadata caching from various providers
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
    
    -- Additional metadata
    videos JSONB, -- trailers, teasers, etc.
    images JSONB, -- additional images
    "cast" JSONB, -- cast information
    crew JSONB, -- crew information
    keywords JSONB,
    
    -- Cache management
    raw_response JSONB, -- store complete API response for flexibility
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(provider, provider_id, content_type, season_number, episode_number)
);

-- Create indexes for efficient lookups
CREATE INDEX idx_content_metadata_provider ON content_metadata(provider);
CREATE INDEX idx_content_metadata_provider_id ON content_metadata(provider_id);
CREATE INDEX idx_content_metadata_content_type ON content_metadata(content_type);
CREATE INDEX idx_content_metadata_provider_type ON content_metadata(provider, provider_id, content_type);
CREATE INDEX idx_content_metadata_parent ON content_metadata(parent_provider_id);
CREATE INDEX idx_content_metadata_fetched ON content_metadata(fetched_at);
CREATE INDEX idx_content_metadata_title ON content_metadata(title);

-- Create GIN indexes for JSONB fields for efficient querying
CREATE INDEX idx_content_metadata_genres ON content_metadata USING GIN (genres);
CREATE INDEX idx_content_metadata_external_ids ON content_metadata USING GIN (external_ids);

-- Add comments
COMMENT ON TABLE content_metadata IS 'Cached content metadata from various providers (TMDB, IMDB, etc.)';
COMMENT ON COLUMN content_metadata.provider IS 'Source provider of the metadata (tmdb, imdb, tvdb, etc.)';
COMMENT ON COLUMN content_metadata.provider_id IS 'ID from the provider';
COMMENT ON COLUMN content_metadata.content_type IS 'Type of content: movie, tv, season, or episode';
COMMENT ON COLUMN content_metadata.external_ids IS 'Cross-reference IDs from other providers';
COMMENT ON COLUMN content_metadata.parent_provider_id IS 'Reference to parent show for seasons and episodes';
COMMENT ON COLUMN content_metadata.raw_response IS 'Complete API response for future flexibility';