-- Drop legacy subtitle tables from user DB (no backwards compatibility required)

-- Drop triggers referencing the legacy table, if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'movie_subtitles_v2'
      AND t.tgname = 'update_movie_subtitles_v2_updated_at'
  ) THEN
    DROP TRIGGER update_movie_subtitles_v2_updated_at ON movie_subtitles_v2;
  END IF;
END $$;

-- Drop legacy tables (indexes will drop with tables)
DROP TABLE IF EXISTS movie_subtitles_v2 CASCADE;
DROP TABLE IF EXISTS movie_subtitles CASCADE;

-- Leave update_updated_at_column() function intact as it may be used elsewhere


