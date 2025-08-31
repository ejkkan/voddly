-- Fix playback_speed column type to work with Encore's Rust runtime
ALTER TABLE profile_watch_state 
    ALTER COLUMN playback_speed TYPE FLOAT USING playback_speed::FLOAT;