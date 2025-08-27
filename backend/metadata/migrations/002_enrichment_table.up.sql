-- Content enrichment table for external API data
-- Stores data from OMDB, FanArt, YouTube that TMDB doesn't provide

CREATE TABLE IF NOT EXISTS content_enrichment (
  id SERIAL PRIMARY KEY,
  tmdb_id INTEGER NOT NULL,
  content_type VARCHAR(20) NOT NULL,
  
  -- OMDB Data
  imdb_id VARCHAR(20), -- Kept for convenience even though it's in content_metadata.external_ids
  imdb_rating REAL, -- Using REAL instead of DECIMAL for better compatibility
  imdb_votes INTEGER,
  metascore INTEGER,
  rotten_tomatoes VARCHAR(10), -- Original format "84%"
  rotten_tomatoes_score INTEGER, -- Parsed numeric value (84)
  box_office VARCHAR(50), -- Original format "$141,340,178"
  box_office_amount BIGINT, -- Parsed numeric value (141340178)
  awards TEXT,
  rated VARCHAR(10), -- MPAA rating (R, PG-13, etc.)
  
  -- FanArt Artwork URLs (best ones selected)
  logo_url TEXT,
  clearart_url TEXT,
  banner_url TEXT,
  thumb_url TEXT,
  disc_url TEXT,
  poster_url TEXT,
  background_url TEXT,
  
  -- YouTube Trailer Data (primary trailer)
  trailer_youtube_id VARCHAR(50),
  trailer_title VARCHAR(500),
  trailer_thumbnail_url TEXT,
  trailer_channel_name VARCHAR(255),
  trailer_published_at TIMESTAMP,
  
  -- Dynamic JSON responses for multi-item display
  fanart_response JSONB, -- Full response with multiple artworks of each type
  youtube_response JSONB, -- Full response with multiple videos/trailers
  
  -- Timestamps
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint
  UNIQUE (tmdb_id, content_type)
);

-- Indexes for efficient lookups
CREATE INDEX idx_enrichment_tmdb_id ON content_enrichment(tmdb_id);
CREATE INDEX idx_enrichment_content_type ON content_enrichment(content_type);
CREATE INDEX idx_enrichment_imdb_id ON content_enrichment(imdb_id);
CREATE INDEX idx_enrichment_fetched_at ON content_enrichment(fetched_at);

-- Trigger for updated_at
CREATE TRIGGER update_enrichment_updated_at
BEFORE UPDATE ON content_enrichment
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Documentation
COMMENT ON TABLE content_enrichment IS 'Stores enrichment data from external APIs that TMDB does not provide: OMDB ratings/awards/box office, FanArt artwork URLs, YouTube trailer info. Keeps FanArt and YouTube raw JSON responses for dynamic multi-item display';

COMMENT ON COLUMN content_enrichment.imdb_id IS 'IMDb ID - kept for convenience even though available in content_metadata.external_ids';
COMMENT ON COLUMN content_enrichment.imdb_rating IS 'IMDb rating (0.0-10.0) stored as REAL';
COMMENT ON COLUMN content_enrichment.rotten_tomatoes IS 'Original RT score format (e.g. "84%")';
COMMENT ON COLUMN content_enrichment.rotten_tomatoes_score IS 'Parsed RT percentage as integer (0-100)';
COMMENT ON COLUMN content_enrichment.box_office IS 'Original box office format (e.g. "$141,340,178")';
COMMENT ON COLUMN content_enrichment.box_office_amount IS 'Parsed box office revenue in USD';
COMMENT ON COLUMN content_enrichment.rated IS 'MPAA rating (R, PG-13, PG, etc.)';
COMMENT ON COLUMN content_enrichment.fanart_response IS 'Full FanArt API response with all artwork options';
COMMENT ON COLUMN content_enrichment.youtube_response IS 'Full YouTube API response with all video results';

