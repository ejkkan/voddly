-- =====================================================
-- Content Metadata Tables
-- Description: Cached metadata from TMDB and other providers
-- =====================================================

-- Helper function for updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Main content metadata table
CREATE TABLE content_metadata (
    id SERIAL PRIMARY KEY,
    
    -- Provider information
    provider VARCHAR(50) NOT NULL, -- 'tmdb', 'imdb', 'tvdb', etc.
    provider_id VARCHAR(100) NOT NULL, -- ID from the provider
    
    -- Content identification
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('movie', 'tv', 'season', 'episode')),
    title VARCHAR(500),
    original_title VARCHAR(500),
    overview TEXT,
    
    -- Release information
    release_date DATE,
    first_air_date DATE, -- For TV shows
    last_air_date DATE, -- For TV shows
    air_date DATE, -- For seasons
    
    -- Media details
    runtime INTEGER, -- in minutes for movies/episodes
    episode_run_time JSONB, -- array of typical episode runtimes for TV shows
    status VARCHAR(50), -- 'Released', 'Returning Series', etc.
    tagline TEXT,
    original_language VARCHAR(10),
    
    -- Images
    poster_path VARCHAR(500),
    backdrop_path VARCHAR(500),
    images JSONB, -- {posters: [], backdrops: []}
    
    -- Ratings and popularity
    vote_average DECIMAL(3,1),
    vote_count INTEGER,
    popularity DECIMAL(10,3),
    ratings JSONB, -- {tmdb: {score, votes}, imdb: {score, votes}, rotten_tomatoes: {score, fresh}, metacritic: {score, color}}
    
    -- Additional metadata
    genres JSONB, -- Array of {id, name}
    production_companies JSONB, -- Array of {id, name, logo_path}
    networks JSONB, -- For TV shows
    created_by JSONB, -- For TV shows
    
    -- TV Show specific
    number_of_seasons INTEGER,
    number_of_episodes INTEGER,
    
    -- Season specific
    season_number INTEGER,
    
    -- Episode specific
    episode_number INTEGER,
    
    -- Parent references
    parent_provider_id VARCHAR(100), -- for seasons/episodes to reference their show
    
    -- Cast and crew (structured)
    "cast" JSONB, -- Top 15: [{id, name, character, profile_path, order}]
    crew JSONB, -- {directors: [], writers: [], producers: []}
    
    -- Videos (trailers, teasers)
    videos JSONB, -- [{key, name, type, official}]
    
    -- External IDs for cross-referencing
    external_ids JSONB, -- {tmdb_id: 123, imdb_id: "tt123", tvdb_id: 456}
    
    -- Additional enrichment data
    rated VARCHAR(10), -- MPAA rating
    awards TEXT,
    box_office VARCHAR(50),
    box_office_amount BIGINT,
    
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
CREATE INDEX idx_content_metadata_popularity ON content_metadata(popularity DESC);
CREATE INDEX idx_content_metadata_vote_average ON content_metadata(vote_average DESC);
CREATE INDEX idx_content_metadata_release_date ON content_metadata(release_date DESC);

-- JSONB indexes for efficient queries
CREATE INDEX idx_content_metadata_genres ON content_metadata USING GIN (genres);
CREATE INDEX idx_content_metadata_external_ids ON content_metadata USING GIN (external_ids);
CREATE INDEX idx_content_metadata_ratings ON content_metadata USING GIN (ratings);

-- Specific external ID indexes for fast lookups
CREATE INDEX idx_content_metadata_tmdb_id ON content_metadata ((external_ids->>'tmdb_id'));
CREATE INDEX idx_content_metadata_imdb_id ON content_metadata ((external_ids->>'imdb_id'));

-- Trigger for updated_at
CREATE TRIGGER update_content_metadata_updated_at
BEFORE UPDATE ON content_metadata
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE content_metadata IS 'Cached metadata from various content providers';
COMMENT ON COLUMN content_metadata.content_type IS 'Type of content: movie, tv, season, or episode';
COMMENT ON COLUMN content_metadata.external_ids IS 'Cross-reference IDs from other providers';
COMMENT ON COLUMN content_metadata.parent_provider_id IS 'Reference to parent show for seasons and episodes';
COMMENT ON COLUMN content_metadata.ratings IS 'Structured ratings: {tmdb: {score, votes}, imdb: {score, votes}, etc.}';
COMMENT ON COLUMN content_metadata."cast" IS 'Top 15 cast members: [{id, name, character, profile_path, order}]';
COMMENT ON COLUMN content_metadata.crew IS 'Key crew: {directors: [], writers: [], producers: []}';
COMMENT ON COLUMN content_metadata.images IS 'Curated images: {posters: [], backdrops: []}';
COMMENT ON COLUMN content_metadata.videos IS 'Trailers and teasers: [{key, name, type, official}]';