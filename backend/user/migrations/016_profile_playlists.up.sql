-- Playlists per profile, and ordered items per playlist

CREATE TABLE IF NOT EXISTS profile_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','shared','public')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (profile_id, name)
);

CREATE INDEX IF NOT EXISTS idx_profile_playlists_profile ON profile_playlists(profile_id);

CREATE TABLE IF NOT EXISTS profile_playlist_items (
  playlist_id UUID NOT NULL REFERENCES profile_playlists(id) ON DELETE CASCADE,
  content_uid TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (playlist_id, content_uid)
);

CREATE INDEX IF NOT EXISTS idx_profile_playlist_items_playlist
  ON profile_playlist_items(playlist_id, sort_order ASC, added_at DESC);

-- Migration from legacy profile_watchlist to default playlist per profile
-- Create one default playlist per profile if any watchlist rows exist
WITH profiles_with_watchlist AS (
  SELECT DISTINCT profile_id FROM profile_watchlist
)
INSERT INTO profile_playlists (id, profile_id, name, is_default)
SELECT gen_random_uuid(), p.profile_id, 'Watchlist', true
FROM profiles_with_watchlist p
ON CONFLICT DO NOTHING;

-- Insert items into the created/selected default playlist
INSERT INTO profile_playlist_items (playlist_id, content_uid, sort_order, added_at)
SELECT pl.id, wl.content_uid, wl.sort_order, wl.added_at
FROM profile_watchlist wl
JOIN profile_playlists pl ON pl.profile_id = wl.profile_id AND pl.is_default = true
ON CONFLICT (playlist_id, content_uid) DO NOTHING;

