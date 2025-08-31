-- Migration to support multiple subtitle sources and lazy loading
-- This creates a new table with better structure while preserving existing data

-- Step 1: Create new subtitles table with support for multiple sources
CREATE TABLE movie_subtitles_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id TEXT NOT NULL,
  tmdb_id INTEGER,
  language_code TEXT NOT NULL,
  language_name TEXT NOT NULL,
  source TEXT NOT NULL, -- 'opensubs', 'subdl', etc.
  source_id TEXT NOT NULL, -- ID from the source provider
  content TEXT, -- NULL when only metadata is stored
  metadata JSONB, -- Additional metadata from provider
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Create indexes for efficient lookups
CREATE INDEX idx_movie_subtitles_v2_movie_id ON movie_subtitles_v2(movie_id);
CREATE INDEX idx_movie_subtitles_v2_tmdb_id ON movie_subtitles_v2(tmdb_id);
CREATE INDEX idx_movie_subtitles_v2_tmdb_lang ON movie_subtitles_v2(tmdb_id, language_code);
CREATE INDEX idx_movie_subtitles_v2_movie_lang ON movie_subtitles_v2(movie_id, language_code);
CREATE INDEX idx_movie_subtitles_v2_source ON movie_subtitles_v2(source);

-- Step 3: Create unique constraint to prevent duplicates per source
-- Allow multiple sources per language, but not duplicates from same source
CREATE UNIQUE INDEX idx_movie_subtitles_v2_unique 
ON movie_subtitles_v2(movie_id, language_code, source);

-- Step 4: Create partial index for content lookups (only when content exists)
CREATE INDEX idx_movie_subtitles_v2_with_content 
ON movie_subtitles_v2(movie_id, language_code) 
WHERE content IS NOT NULL;

-- Step 5: Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_movie_subtitles_v2_updated_at 
BEFORE UPDATE ON movie_subtitles_v2 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Migrate existing data from old table to new table
-- Map all existing subtitles to 'opensubs' source since that's what we had before
INSERT INTO movie_subtitles_v2 (
  movie_id, tmdb_id, language_code, language_name, 
  source, source_id, content, created_at
)
SELECT 
  movie_id, 
  tmdb_id, 
  language_code, 
  language_name,
  'opensubs' as source,
  COALESCE(id::text, gen_random_uuid()::text) as source_id,
  content,
  created_at
FROM movie_subtitles
ON CONFLICT (movie_id, language_code, source) DO NOTHING;

-- Step 7: Add comments for documentation
COMMENT ON TABLE movie_subtitles_v2 IS 'Enhanced subtitle cache supporting multiple providers and lazy loading';
COMMENT ON COLUMN movie_subtitles_v2.source IS 'Subtitle provider: opensubs, subdl, etc.';
COMMENT ON COLUMN movie_subtitles_v2.source_id IS 'ID from the subtitle provider';
COMMENT ON COLUMN movie_subtitles_v2.content IS 'Subtitle content (NULL for metadata-only entries)';
COMMENT ON COLUMN movie_subtitles_v2.metadata IS 'Additional metadata from provider (JSON)';

-- Note: We keep the old table for now in case of rollback needs
-- In a future migration, we can drop the old table once everything is working
COMMENT ON TABLE movie_subtitles IS 'Legacy subtitle table - will be deprecated in favor of movie_subtitles_v2';
