-- Create subtitles table in metadata DB (clean schema)

-- Ensure helper trigger function exists (scoped to this DB)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Main table for subtitle metadata and optional cached content
CREATE TABLE IF NOT EXISTS subtitles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id TEXT NOT NULL,
  tmdb_id INTEGER,
  language_code TEXT NOT NULL,
  language_name TEXT NOT NULL,
  source TEXT NOT NULL,          -- 'opensubs', 'subdl', 'original', etc.
  source_id TEXT NOT NULL,       -- ID from the source provider (or deterministic for 'original')
  content TEXT,                  -- NULL when only metadata is stored
  metadata JSONB,                -- Provider metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_subtitles_movie_id ON subtitles(movie_id);
CREATE INDEX IF NOT EXISTS idx_subtitles_tmdb_id ON subtitles(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_subtitles_tmdb_lang ON subtitles(tmdb_id, language_code);
CREATE INDEX IF NOT EXISTS idx_subtitles_movie_lang ON subtitles(movie_id, language_code);
CREATE INDEX IF NOT EXISTS idx_subtitles_source ON subtitles(source);

-- Unique constraint to prevent duplicates per source per language
CREATE UNIQUE INDEX IF NOT EXISTS idx_subtitles_unique
ON subtitles(movie_id, language_code, source);

-- Partial index for fast lookups that need content
CREATE INDEX IF NOT EXISTS idx_subtitles_with_content
ON subtitles(movie_id, language_code)
WHERE content IS NOT NULL;

-- Trigger to keep updated_at current
DROP TRIGGER IF EXISTS update_subtitles_updated_at ON subtitles;
CREATE TRIGGER update_subtitles_updated_at
BEFORE UPDATE ON subtitles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Documentation
COMMENT ON TABLE subtitles IS 'Subtitle metadata and cached content stored in metadata DB';
COMMENT ON COLUMN subtitles.source IS 'Subtitle provider: opensubs, subdl, original, etc.';
COMMENT ON COLUMN subtitles.source_id IS 'ID from the provider; deterministic for original tracks';
COMMENT ON COLUMN subtitles.content IS 'Cached SRT/VTT content (NULL when only metadata is stored)';
COMMENT ON COLUMN subtitles.metadata IS 'Original provider metadata payload';


