-- Fix uniqueness to prevent duplicates when NULLs are involved
-- Strategy:
-- 1) Remove the overly-broad unique constraint on (provider, provider_id, content_type, season_number, episode_number)
-- 2) Add separate unique indexes per content level with partial predicates:
--    - Movies/TV (no season/episode): unique on (provider, provider_id, content_type) WHERE season_number IS NULL AND episode_number IS NULL
--    - Seasons: unique on (provider, parent_provider_id, season_number) WHERE content_type = 'season'
--    - Episodes: unique on (provider, parent_provider_id, season_number, episode_number) WHERE content_type = 'episode'

DO $$
BEGIN
  -- Drop the original unique constraint if it exists
  BEGIN
    ALTER TABLE content_metadata DROP CONSTRAINT content_metadata_provider_provider_id_content_type_season_number_episode_number_key;
  EXCEPTION WHEN undefined_object THEN
    -- constraint name may differ on some installations; attempt by index name too
    BEGIN
      DROP INDEX IF EXISTS content_metadata_provider_provider_id_content_type_season_number_episode_number_key;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END;

  -- Drop any legacy indexes we might have created earlier for this tuple
  PERFORM 1;
END $$;

-- Add partial unique index for top-level content (movie/tv)
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_metadata_unique_top_level
ON content_metadata(provider, provider_id, content_type)
WHERE season_number IS NULL AND episode_number IS NULL;

-- Add unique index for seasons (use parent_provider_id to anchor to the show)
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_metadata_unique_season
ON content_metadata(provider, parent_provider_id, season_number)
WHERE content_type = 'season' AND season_number IS NOT NULL;

-- Add unique index for episodes (use parent_provider_id and season/episode numbers)
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_metadata_unique_episode
ON content_metadata(provider, parent_provider_id, season_number, episode_number)
WHERE content_type = 'episode' AND season_number IS NOT NULL AND episode_number IS NOT NULL;

-- Optional: best-effort duplicate cleanup keeping the latest row per key
-- Top-level duplicates
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY provider, provider_id, content_type
    ORDER BY updated_at DESC
  ) AS rn
  FROM content_metadata
  WHERE season_number IS NULL AND episode_number IS NULL
)
DELETE FROM content_metadata cm
USING ranked r
WHERE cm.id = r.id AND r.rn > 1;

-- Seasons duplicates
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY provider, parent_provider_id, season_number
    ORDER BY updated_at DESC
  ) AS rn
  FROM content_metadata
  WHERE content_type = 'season' AND season_number IS NOT NULL
)
DELETE FROM content_metadata cm
USING ranked r
WHERE cm.id = r.id AND r.rn > 1;

-- Episodes duplicates
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY provider, parent_provider_id, season_number, episode_number
    ORDER BY updated_at DESC
  ) AS rn
  FROM content_metadata
  WHERE content_type = 'episode' AND season_number IS NOT NULL AND episode_number IS NOT NULL
)
DELETE FROM content_metadata cm
USING ranked r
WHERE cm.id = r.id AND r.rn > 1;


