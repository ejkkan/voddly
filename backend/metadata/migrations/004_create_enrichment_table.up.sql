-- Create content enrichment table for external API data
CREATE TABLE IF NOT EXISTS content_enrichment (
  id SERIAL PRIMARY KEY,
  tmdb_id INTEGER NOT NULL,
  content_type VARCHAR(20) NOT NULL,
  
  -- OMDB Data
  imdb_id VARCHAR(20),
  imdb_rating DECIMAL(3,1),
  imdb_votes INTEGER,
  metascore INTEGER,
  rotten_tomatoes VARCHAR(10),
  box_office VARCHAR(50),
  awards TEXT,
  rated VARCHAR(10),
  
  -- Trakt Data
  trakt_id VARCHAR(50),
  trakt_slug VARCHAR(100),
  trakt_rating DECIMAL(3,1),
  trakt_votes INTEGER,
  watchers INTEGER,
  plays INTEGER,
  collected_count INTEGER,
  watched_count INTEGER,
  trending_rank INTEGER,
  
  -- FanArt URLs (best quality for each type)
  logo_url TEXT,
  clearart_url TEXT,
  banner_url TEXT,
  thumb_url TEXT,
  disc_url TEXT,
  poster_url TEXT,
  background_url TEXT,
  
  -- YouTube Data (top trailer)
  trailer_youtube_id VARCHAR(50),
  trailer_title TEXT,
  
  -- Raw responses for debugging (optional)
  omdb_response JSONB,
  trakt_response JSONB,
  fanart_response JSONB,
  youtube_response JSONB,
  
  -- Timestamps
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint
  UNIQUE(tmdb_id, content_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_enrichment_tmdb ON content_enrichment(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_type ON content_enrichment(content_type);
CREATE INDEX IF NOT EXISTS idx_enrichment_trending ON content_enrichment(trending_rank) 
  WHERE trending_rank IS NOT NULL;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_enrichment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_content_enrichment_updated_at ON content_enrichment;
CREATE TRIGGER update_content_enrichment_updated_at
BEFORE UPDATE ON content_enrichment
FOR EACH ROW EXECUTE FUNCTION update_enrichment_updated_at();

-- Add comment for documentation
COMMENT ON TABLE content_enrichment IS 'Enriched metadata from external APIs (OMDB, Trakt, FanArt, YouTube)';