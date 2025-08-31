-- Minimal subtitles table for storing subtitle content
CREATE TABLE movie_subtitles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id TEXT NOT NULL,
  language_code TEXT NOT NULL,
  language_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_movie_subtitles_movie ON movie_subtitles(movie_id);

COMMENT ON TABLE movie_subtitles IS 'Cached subtitle content for movies from OpenSubtitles and other sources';
