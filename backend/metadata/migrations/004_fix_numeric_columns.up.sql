-- Change DECIMAL columns to DOUBLE PRECISION for better compatibility with Encore
ALTER TABLE content_metadata 
  ALTER COLUMN vote_average TYPE DOUBLE PRECISION,
  ALTER COLUMN popularity TYPE DOUBLE PRECISION;