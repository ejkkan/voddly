-- Allow 'episode' content_type in profile_favorites
ALTER TABLE profile_favorites
  DROP CONSTRAINT IF EXISTS profile_favorites_content_type_check;

ALTER TABLE profile_favorites
  ADD CONSTRAINT profile_favorites_content_type_check
  CHECK (content_type IN ('movie', 'series', 'tv', 'category', 'channel', 'episode'));


