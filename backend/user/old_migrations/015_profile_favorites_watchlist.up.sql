-- Create profile_favorites and profile_watchlist tables

-- Favorites: one row per profile/content
CREATE TABLE IF NOT EXISTS profile_favorites (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_uid TEXT NOT NULL,
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (profile_id, content_uid)
);

CREATE INDEX IF NOT EXISTS idx_profile_favorites_profile
  ON profile_favorites (profile_id, added_at DESC);

-- Watchlist: ordered list per profile/content
CREATE TABLE IF NOT EXISTS profile_watchlist (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_uid TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (profile_id, content_uid)
);

CREATE INDEX IF NOT EXISTS idx_profile_watchlist_profile
  ON profile_watchlist (profile_id, sort_order ASC, added_at DESC);

-- Ensure profile_watch_state has minimal finished flags
ALTER TABLE profile_watch_state
  ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profile_watch_state
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

