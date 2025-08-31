-- =====================================================
-- Helper Functions
-- Description: PostgreSQL functions for complex operations
-- =====================================================

-- Function to get accessible sources for a profile
CREATE OR REPLACE FUNCTION get_profile_sources(p_profile_id UUID)
RETURNS TABLE (source_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT s.id
    FROM sources s
    JOIN profiles p ON p.id = p_profile_id
    WHERE s.subscription_id = p.subscription_id
      AND (
        p.has_source_restrictions = FALSE
        OR EXISTS (
          SELECT 1 FROM profile_sources ps
          WHERE ps.profile_id = p_profile_id
            AND ps.source_id = s.id
        )
      );
END;
$$ LANGUAGE plpgsql;

-- Function to check if profile can access a source
CREATE OR REPLACE FUNCTION can_profile_access_source(p_profile_id UUID, p_source_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    has_restrictions BOOLEAN;
    is_allowed BOOLEAN;
BEGIN
    -- Get profile restrictions setting
    SELECT has_source_restrictions INTO has_restrictions
    FROM profiles
    WHERE id = p_profile_id;
    
    -- If no restrictions, allow access
    IF has_restrictions = FALSE OR has_restrictions IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Check if source is in allowed list
    SELECT EXISTS (
        SELECT 1 FROM profile_sources
        WHERE profile_id = p_profile_id
          AND source_id = p_source_id
    ) INTO is_allowed;
    
    RETURN is_allowed;
END;
$$ LANGUAGE plpgsql;

-- Function to copy profile sources from one profile to another
CREATE OR REPLACE FUNCTION copy_profile_sources(p_from_profile_id UUID, p_to_profile_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO profile_sources (profile_id, source_id)
    SELECT p_to_profile_id, source_id
    FROM profile_sources
    WHERE profile_id = p_from_profile_id
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to get profile statistics
CREATE OR REPLACE FUNCTION get_profile_stats(p_profile_id UUID)
RETURNS TABLE (
    total_watched INTEGER,
    total_favorites INTEGER,
    total_watchlist INTEGER,
    total_playlists INTEGER,
    total_watch_time_hours DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM profile_watch_state WHERE profile_id = p_profile_id AND last_position_seconds > 0)::INTEGER as total_watched,
        (SELECT COUNT(*) FROM profile_favorites WHERE profile_id = p_profile_id)::INTEGER as total_favorites,
        (SELECT COUNT(*) FROM profile_watch_state WHERE profile_id = p_profile_id AND in_watchlist = TRUE)::INTEGER as total_watchlist,
        (SELECT COUNT(*) FROM profile_playlists WHERE profile_id = p_profile_id)::INTEGER as total_playlists,
        (SELECT COALESCE(SUM(last_position_seconds) / 3600.0, 0) FROM profile_watch_state WHERE profile_id = p_profile_id)::DECIMAL as total_watch_time_hours;
END;
$$ LANGUAGE plpgsql;


-- Function to get subscription device count
CREATE OR REPLACE FUNCTION get_active_device_count(p_subscription_id UUID)
RETURNS INTEGER AS $$
DECLARE
    device_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO device_count
    FROM subscription_devices
    WHERE subscription_id = p_subscription_id
      AND is_active = TRUE;
    
    RETURN device_count;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON FUNCTION get_profile_sources IS 'Get all sources accessible by a profile considering restrictions';
COMMENT ON FUNCTION can_profile_access_source IS 'Check if a profile has access to a specific source';
COMMENT ON FUNCTION copy_profile_sources IS 'Copy source restrictions from one profile to another';
COMMENT ON FUNCTION get_profile_stats IS 'Get statistics for a profile';
COMMENT ON FUNCTION get_active_device_count IS 'Get count of active devices for a subscription';