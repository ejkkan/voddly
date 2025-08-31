-- =====================================================
-- Content Enrichment Tables
-- Description: Additional metadata from specialized providers
-- =====================================================

-- Content enrichment from additional providers
CREATE TABLE content_enrichment (
    id SERIAL PRIMARY KEY,
    tmdb_id INTEGER NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('movie', 'tv')),
    
    -- OMDB data
    imdb_rating DECIMAL(3,1),
    imdb_votes INTEGER,
    metascore INTEGER,
    rotten_tomatoes_score INTEGER,
    
    -- Box office and awards
    awards TEXT,
    box_office VARCHAR(50),
    box_office_amount BIGINT,
    dvd_release DATE,
    production TEXT,
    website VARCHAR(500),
    rated VARCHAR(10), -- MPAA rating
    
    -- Fanart.tv images
    clearlogo_url VARCHAR(500),
    clearart_url VARCHAR(500),
    hdmovielogo_url VARCHAR(500),
    moviethumb_url VARCHAR(500),
    moviebanner_url VARCHAR(500),
    
    -- YouTube trailers
    youtube_trailer_id VARCHAR(50),
    youtube_trailer_thumbnail VARCHAR(500),
    
    -- Trakt.tv data
    trakt_id INTEGER,
    trakt_slug VARCHAR(255),
    trakt_rating DECIMAL(3,1),
    trakt_votes INTEGER,
    trakt_watchers INTEGER,
    trakt_plays INTEGER,
    trakt_collected INTEGER,
    trakt_watched_progress DECIMAL(5,2),
    
    -- Timestamps
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE (tmdb_id, content_type)
);

-- Indexes for content_enrichment
CREATE INDEX idx_enrichment_tmdb ON content_enrichment(tmdb_id);
CREATE INDEX idx_enrichment_content_type ON content_enrichment(content_type);
CREATE INDEX idx_enrichment_tmdb_type ON content_enrichment(tmdb_id, content_type);
CREATE INDEX idx_enrichment_trakt ON content_enrichment(trakt_id) WHERE trakt_id IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_content_enrichment_updated_at
BEFORE UPDATE ON content_enrichment
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE content_enrichment IS 'Additional metadata from specialized providers';
COMMENT ON COLUMN content_enrichment.tmdb_id IS 'TMDB ID to link with main metadata';
COMMENT ON COLUMN content_enrichment.imdb_rating IS 'IMDB rating from OMDB';
COMMENT ON COLUMN content_enrichment.metascore IS 'Metacritic score from OMDB';
COMMENT ON COLUMN content_enrichment.rotten_tomatoes_score IS 'Rotten Tomatoes percentage';
COMMENT ON COLUMN content_enrichment.clearlogo_url IS 'Clear logo from Fanart.tv';
COMMENT ON COLUMN content_enrichment.trakt_rating IS 'Rating from Trakt.tv';