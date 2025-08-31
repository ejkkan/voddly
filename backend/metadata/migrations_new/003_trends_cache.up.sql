-- =====================================================
-- Trends and Caching Tables
-- Description: Cache trending content and optimize performance
-- =====================================================

-- Trends cache table for fast access to trending content
CREATE TABLE trends_cache (
    id SERIAL PRIMARY KEY,
    
    -- Trend identification
    trend_type VARCHAR(50) NOT NULL, -- 'trending_movies', 'trending_tv', 'popular_movies', 'popular_tv', 'top_rated_movies', 'top_rated_tv'
    time_window VARCHAR(20) NOT NULL DEFAULT 'week', -- 'day', 'week'
    
    -- Cached data
    data JSONB NOT NULL, -- Array of content with all display data
    item_count INTEGER DEFAULT 0,
    
    -- Cache management
    cache_key VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(cache_key)
);

-- Content discovery cache (for recommendations, similar content)
CREATE TABLE discovery_cache (
    id SERIAL PRIMARY KEY,
    
    -- Source content
    source_tmdb_id INTEGER NOT NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('movie', 'tv')),
    
    -- Discovery type
    discovery_type VARCHAR(50) NOT NULL, -- 'similar', 'recommendations', 'by_genre', 'by_cast', 'by_director'
    
    -- Cached results
    results JSONB NOT NULL, -- Array of related content
    result_count INTEGER DEFAULT 0,
    
    -- Cache management
    expires_at TIMESTAMP NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(source_tmdb_id, source_type, discovery_type)
);

-- Search cache for frequently searched terms
CREATE TABLE search_cache (
    id SERIAL PRIMARY KEY,
    
    -- Search parameters
    query TEXT NOT NULL,
    search_type VARCHAR(20) NOT NULL CHECK (search_type IN ('multi', 'movie', 'tv', 'person')),
    page INTEGER DEFAULT 1,
    
    -- Results
    results JSONB NOT NULL,
    total_results INTEGER DEFAULT 0,
    total_pages INTEGER DEFAULT 1,
    
    -- Cache management
    cache_key VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 1,
    
    UNIQUE(cache_key)
);

-- Indexes for trends_cache
CREATE INDEX idx_trends_cache_type ON trends_cache(trend_type);
CREATE INDEX idx_trends_cache_window ON trends_cache(time_window);
CREATE INDEX idx_trends_cache_expires ON trends_cache(expires_at);
CREATE INDEX idx_trends_cache_key ON trends_cache(cache_key);

-- Indexes for discovery_cache
CREATE INDEX idx_discovery_source ON discovery_cache(source_tmdb_id, source_type);
CREATE INDEX idx_discovery_type ON discovery_cache(discovery_type);
CREATE INDEX idx_discovery_expires ON discovery_cache(expires_at);

-- Indexes for search_cache
CREATE INDEX idx_search_cache_query ON search_cache(query);
CREATE INDEX idx_search_cache_type ON search_cache(search_type);
CREATE INDEX idx_search_cache_key ON search_cache(cache_key);
CREATE INDEX idx_search_cache_expires ON search_cache(expires_at);
CREATE INDEX idx_search_cache_popular ON search_cache(access_count DESC, accessed_at DESC);

-- Triggers for updated_at
CREATE TRIGGER update_trends_cache_updated_at
BEFORE UPDATE ON trends_cache
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discovery_cache_updated_at
BEFORE UPDATE ON discovery_cache
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update search cache access
CREATE OR REPLACE FUNCTION update_search_cache_access()
RETURNS TRIGGER AS $$
BEGIN
    NEW.accessed_at = CURRENT_TIMESTAMP;
    NEW.access_count = OLD.access_count + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track search cache hits
CREATE TRIGGER track_search_cache_access
BEFORE UPDATE ON search_cache
FOR EACH ROW
WHEN (OLD.accessed_at IS DISTINCT FROM NEW.accessed_at)
EXECUTE FUNCTION update_search_cache_access();

-- Cleanup function for expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM trends_cache WHERE expires_at < CURRENT_TIMESTAMP;
    DELETE FROM discovery_cache WHERE expires_at < CURRENT_TIMESTAMP;
    DELETE FROM search_cache WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE trends_cache IS 'Cached trending content for fast access';
COMMENT ON COLUMN trends_cache.trend_type IS 'Type of trend: trending, popular, top_rated';
COMMENT ON COLUMN trends_cache.data IS 'Complete content data ready for display';

COMMENT ON TABLE discovery_cache IS 'Cached recommendations and similar content';
COMMENT ON COLUMN discovery_cache.discovery_type IS 'Type: similar, recommendations, by_genre, etc.';

COMMENT ON TABLE search_cache IS 'Cached search results for popular queries';
COMMENT ON COLUMN search_cache.access_count IS 'Number of times this cache entry was accessed';