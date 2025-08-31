-- Step 1: Clean up existing duplicate subtitles before applying constraints
-- Keep only the most recent subtitle for each tmdb_id + language_code combination

-- First, identify and delete duplicates based on tmdb_id + language_code
-- Keep the record with the latest created_at timestamp
WITH duplicates AS (
  SELECT id,
         tmdb_id,
         language_code,
         ROW_NUMBER() OVER (
           PARTITION BY tmdb_id, language_code 
           ORDER BY created_at DESC, id DESC
         ) as rn
  FROM movie_subtitles
  WHERE tmdb_id IS NOT NULL
)
DELETE FROM movie_subtitles 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Also clean up duplicates for records without tmdb_id (using movie_id + language_code)
WITH legacy_duplicates AS (
  SELECT id,
         movie_id,
         language_code,
         ROW_NUMBER() OVER (
           PARTITION BY movie_id, language_code 
           ORDER BY created_at DESC, id DESC
         ) as rn
  FROM movie_subtitles
  WHERE tmdb_id IS NULL
)
DELETE FROM movie_subtitles 
WHERE id IN (
  SELECT id FROM legacy_duplicates WHERE rn > 1
);

-- Step 2: Create unique indexes to prevent future duplicates
-- Primary constraint: tmdb_id + language_code (for movies with TMDB IDs)
-- Note: Using partial index for performance, but not adding constraint since partial indexes can't be used for constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_movie_subtitles_tmdb_lang_unique 
ON movie_subtitles(tmdb_id, language_code) 
WHERE tmdb_id IS NOT NULL;

-- Fallback constraint: movie_id + language_code (for movies without TMDB IDs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_movie_subtitles_movie_lang_fallback
ON movie_subtitles(movie_id, language_code) 
WHERE tmdb_id IS NULL;

-- Step 3: Create a simple unique constraint for the most common case
-- This will prevent duplicates at the database level
ALTER TABLE movie_subtitles 
ADD CONSTRAINT unique_movie_id_language UNIQUE (movie_id, language_code);

COMMENT ON CONSTRAINT unique_movie_id_language ON movie_subtitles IS 'Prevents duplicate subtitles for the same movie and language';
COMMENT ON INDEX idx_movie_subtitles_movie_lang_fallback IS 'Fallback unique constraint for movies without TMDB ID';
COMMENT ON TABLE movie_subtitles IS 'Subtitle cache with proper uniqueness constraints to prevent duplicates';
