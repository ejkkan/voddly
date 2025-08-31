-- Optimize metadata storage in single table with structured JSONB
-- Removes raw_response and structures data for efficient display

-- 1. Drop the raw_response column and other unused fields
ALTER TABLE content_metadata 
  DROP COLUMN IF EXISTS raw_response CASCADE,
  DROP COLUMN IF EXISTS keywords CASCADE;

-- 2. Add structured rating column if not exists
ALTER TABLE content_metadata
  ADD COLUMN IF NOT EXISTS ratings JSONB,
  ADD COLUMN IF NOT EXISTS awards TEXT,
  ADD COLUMN IF NOT EXISTS rated VARCHAR(10),
  ADD COLUMN IF NOT EXISTS box_office VARCHAR(50),
  ADD COLUMN IF NOT EXISTS box_office_amount BIGINT;

-- 3. Update content_enrichment to only store what we need
ALTER TABLE content_enrichment
  DROP COLUMN IF EXISTS fanart_response CASCADE,
  DROP COLUMN IF EXISTS youtube_response CASCADE;

-- 4. Create helper function to clean and structure JSONB arrays
CREATE OR REPLACE FUNCTION clean_json_array(input_json JSONB, max_items INTEGER DEFAULT 10)
RETURNS JSONB AS $$
BEGIN
  IF input_json IS NULL OR jsonb_typeof(input_json) != 'array' THEN
    RETURN '[]'::jsonb;
  END IF;
  
  -- Return only the first max_items elements
  RETURN (
    SELECT jsonb_agg(elem)
    FROM (
      SELECT elem
      FROM jsonb_array_elements(input_json) elem
      LIMIT max_items
    ) t
  );
END;
$$ LANGUAGE plpgsql;

-- 5. Clean up existing cast/crew data to only keep essential info
UPDATE content_metadata
SET 
  -- Keep only top 15 cast members with essential fields
  "cast" = CASE 
    WHEN "cast" IS NOT NULL 
    THEN (
      SELECT jsonb_agg(actor)
      FROM (
        SELECT jsonb_build_object(
          'id', (c->>'id')::INTEGER,
          'name', c->>'name',
          'character', c->>'character',
          'profile_path', c->>'profile_path',
          'order', (c->>'order')::INTEGER
        ) as actor
        FROM jsonb_array_elements("cast") c
        ORDER BY (c->>'order')::INTEGER
        LIMIT 15
      ) t
    )
    ELSE '[]'::jsonb
  END,
  
  -- Structure crew as {directors: [], writers: [], producers: []}
  crew = CASE 
    WHEN crew IS NOT NULL 
    THEN jsonb_build_object(
      'directors', (
        SELECT jsonb_agg(DISTINCT jsonb_build_object(
          'id', (c->>'id')::INTEGER,
          'name', c->>'name',
          'profile_path', c->>'profile_path'
        ))
        FROM jsonb_array_elements(crew) c
        WHERE c->>'job' = 'Director'
        LIMIT 3
      ),
      'writers', (
        SELECT jsonb_agg(DISTINCT jsonb_build_object(
          'id', (c->>'id')::INTEGER,
          'name', c->>'name',
          'profile_path', c->>'profile_path'
        ))
        FROM jsonb_array_elements(crew) c
        WHERE c->>'job' IN ('Writer', 'Screenplay', 'Story')
        LIMIT 3
      ),
      'producers', (
        SELECT jsonb_agg(DISTINCT jsonb_build_object(
          'id', (c->>'id')::INTEGER,
          'name', c->>'name',
          'profile_path', c->>'profile_path'
        ))
        FROM jsonb_array_elements(crew) c
        WHERE c->>'job' IN ('Producer', 'Executive Producer')
        LIMIT 5
      )
    )
    ELSE jsonb_build_object('directors', '[]'::jsonb, 'writers', '[]'::jsonb, 'producers', '[]'::jsonb)
  END,
  
  -- Clean up images to only keep top rated ones
  images = CASE
    WHEN images IS NOT NULL
    THEN jsonb_build_object(
      'posters', clean_json_array(
        CASE 
          WHEN images->'posters' IS NOT NULL
          THEN (
            SELECT jsonb_agg(img)
            FROM (
              SELECT jsonb_build_object(
                'file_path', p->>'file_path',
                'vote_average', (p->>'vote_average')::DECIMAL,
                'language', p->>'iso_639_1'
              ) as img
              FROM jsonb_array_elements(images->'posters') p
              WHERE p->>'iso_639_1' IN ('en', 'null', '') 
                 OR (p->>'vote_average')::DECIMAL > 5
              ORDER BY 
                CASE WHEN p->>'iso_639_1' = 'en' THEN 0 ELSE 1 END,
                (p->>'vote_average')::DECIMAL DESC NULLS LAST
              LIMIT 10
            ) t
          )
          ELSE '[]'::jsonb
        END, 10
      ),
      'backdrops', clean_json_array(
        CASE 
          WHEN images->'backdrops' IS NOT NULL
          THEN (
            SELECT jsonb_agg(img)
            FROM (
              SELECT jsonb_build_object(
                'file_path', b->>'file_path',
                'vote_average', (b->>'vote_average')::DECIMAL,
                'language', b->>'iso_639_1'
              ) as img
              FROM jsonb_array_elements(images->'backdrops') b
              WHERE b->>'iso_639_1' IN ('en', 'null', '')
                 OR (b->>'vote_average')::DECIMAL > 5
              ORDER BY 
                CASE WHEN b->>'iso_639_1' = 'en' THEN 0 ELSE 1 END,
                (b->>'vote_average')::DECIMAL DESC NULLS LAST
              LIMIT 10
            ) t
          )
          ELSE '[]'::jsonb
        END, 10
      )
    )
    ELSE jsonb_build_object('posters', '[]'::jsonb, 'backdrops', '[]'::jsonb)
  END,
  
  -- Keep only essential trailer info
  videos = CASE
    WHEN videos IS NOT NULL AND videos->'results' IS NOT NULL
    THEN (
      SELECT jsonb_agg(video)
      FROM (
        SELECT jsonb_build_object(
          'key', v->>'key',
          'name', v->>'name',
          'type', v->>'type',
          'official', (v->>'official')::BOOLEAN
        ) as video
        FROM jsonb_array_elements(videos->'results') v
        WHERE v->>'site' = 'YouTube'
          AND v->>'type' IN ('Trailer', 'Teaser')
        ORDER BY 
          CASE WHEN (v->>'official')::BOOLEAN THEN 0 ELSE 1 END,
          CASE WHEN v->>'type' = 'Trailer' THEN 0 ELSE 1 END
        LIMIT 5
      ) t
    )
    ELSE '[]'::jsonb
  END
WHERE provider = 'tmdb';

-- 6. Migrate enrichment data into main table as structured ratings
UPDATE content_metadata cm
SET 
  ratings = jsonb_build_object(
    'tmdb', jsonb_build_object(
      'score', cm.vote_average,
      'votes', cm.vote_count
    ),
    'imdb', CASE 
      WHEN ce.imdb_rating IS NOT NULL 
      THEN jsonb_build_object(
        'score', ce.imdb_rating,
        'votes', ce.imdb_votes
      )
      ELSE NULL
    END,
    'rotten_tomatoes', CASE 
      WHEN ce.rotten_tomatoes_score IS NOT NULL 
      THEN jsonb_build_object(
        'score', ce.rotten_tomatoes_score,
        'fresh', ce.rotten_tomatoes_score >= 60
      )
      ELSE NULL
    END,
    'metacritic', CASE 
      WHEN ce.metascore IS NOT NULL 
      THEN jsonb_build_object(
        'score', ce.metascore,
        'color', CASE 
          WHEN ce.metascore >= 61 THEN 'green'
          WHEN ce.metascore >= 40 THEN 'yellow'
          ELSE 'red'
        END
      )
      ELSE NULL
    END
  ),
  awards = ce.awards,
  rated = ce.rated,
  box_office = ce.box_office,
  box_office_amount = ce.box_office_amount
FROM content_enrichment ce
WHERE (cm.external_ids->>'tmdb_id')::INTEGER = ce.tmdb_id
  AND cm.content_type = ce.content_type
  AND cm.provider = 'tmdb';

-- 7. Clean up production companies to only keep essential info
UPDATE content_metadata
SET production_companies = CASE
  WHEN production_companies IS NOT NULL AND jsonb_typeof(production_companies) = 'array'
  THEN (
    SELECT jsonb_agg(company)
    FROM (
      SELECT jsonb_build_object(
        'id', (p->>'id')::INTEGER,
        'name', p->>'name',
        'logo_path', p->>'logo_path'
      ) as company
      FROM jsonb_array_elements(production_companies) p
      LIMIT 5
    ) t
  )
  ELSE '[]'::jsonb
END
WHERE production_companies IS NOT NULL;

-- 8. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_metadata_ratings ON content_metadata USING GIN (ratings);
CREATE INDEX IF NOT EXISTS idx_metadata_tmdb_id ON content_metadata ((external_ids->>'tmdb_id'));
CREATE INDEX IF NOT EXISTS idx_metadata_imdb_id ON content_metadata ((external_ids->>'imdb_id'));

-- 9. Add comment explaining the new structure
COMMENT ON COLUMN content_metadata.ratings IS 'Structured ratings from multiple sources: {tmdb: {score, votes}, imdb: {score, votes}, rotten_tomatoes: {score, fresh}, metacritic: {score, color}}';
COMMENT ON COLUMN content_metadata."cast" IS 'Top 15 cast members: [{id, name, character, profile_path, order}]';
COMMENT ON COLUMN content_metadata.crew IS 'Key crew members: {directors: [], writers: [], producers: []}';
COMMENT ON COLUMN content_metadata.images IS 'Curated images: {posters: [{file_path, vote_average, language}], backdrops: [...]}';
COMMENT ON COLUMN content_metadata.videos IS 'Trailers and teasers: [{key, name, type, official}]';

-- Clean up the helper function
DROP FUNCTION IF EXISTS clean_json_array(JSONB, INTEGER);