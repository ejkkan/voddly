-- Add tmdb_id to movie_subtitles for efficient subtitle caching
ALTER TABLE movie_subtitles ADD COLUMN tmdb_id INTEGER;

-- Create index for tmdb_id lookups
CREATE INDEX idx_movie_subtitles_tmdb_id ON movie_subtitles(tmdb_id);

-- Add composite index for tmdb_id + language_code for even faster lookups
CREATE INDEX idx_movie_subtitles_tmdb_lang ON movie_subtitles(tmdb_id, language_code);

COMMENT ON COLUMN movie_subtitles.tmdb_id IS 'TMDB ID for efficient subtitle lookup and caching';
