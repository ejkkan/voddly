-- =====================================================
-- PROFILE SOURCE MANAGEMENT ENHANCEMENT
-- Description: Enhances profile source restrictions and management
-- Changes:
--   - Adds source management capabilities for profile owners
--   - Improves profile source restrictions table
--   - Adds source selection UI support
-- =====================================================

-- Step 1: Enhance profile_sources table with additional metadata
-- =====================================================

-- Add metadata columns to profile_sources for better management
ALTER TABLE profile_sources 
  ADD COLUMN IF NOT EXISTS added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profile_sources_added_at ON profile_sources(profile_id, added_at DESC);

-- Step 2: Add source management functions
-- =====================================================

-- Function to get all sources available to an account
CREATE OR REPLACE FUNCTION get_account_sources(account_uuid UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  provider_type TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.provider_type,
    s.is_active,
    s.created_at
  FROM sources s
  WHERE s.account_id = account_uuid AND s.is_active = true
  ORDER BY s.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get sources accessible to a specific profile
CREATE OR REPLACE FUNCTION get_profile_sources(profile_uuid UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  provider_type TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  is_restricted BOOLEAN
) AS $$
DECLARE
  profile_record RECORD;
  source_count INTEGER;
BEGIN
  -- Get profile information
  SELECT p.account_id, p.is_owner INTO profile_record
  FROM profiles p
  WHERE p.id = profile_uuid;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Owner profiles always have access to all sources
  IF profile_record.is_owner THEN
    RETURN QUERY
    SELECT 
      s.id,
      s.name,
      s.provider_type,
      s.is_active,
      s.created_at,
      false as is_restricted
    FROM sources s
    WHERE s.account_id = profile_record.account_id AND s.is_active = true
    ORDER BY s.name ASC;
  ELSE
    -- Check if profile has any source restrictions
    SELECT COUNT(*) INTO source_count
    FROM profile_sources
    WHERE profile_id = profile_uuid;
    
    -- If no restrictions (empty profile_sources), return all account sources
    IF source_count = 0 THEN
      RETURN QUERY
      SELECT 
        s.id,
        s.name,
        s.provider_type,
        s.is_active,
        s.created_at,
        false as is_restricted
      FROM sources s
      WHERE s.account_id = profile_record.account_id AND s.is_active = true
      ORDER BY s.name ASC;
    ELSE
      -- Has restrictions: return only explicitly allowed sources
      RETURN QUERY
      SELECT 
        s.id,
        s.name,
        s.provider_type,
        s.is_active,
        s.created_at,
        true as is_restricted
      FROM sources s
      JOIN profile_sources ps ON s.id = ps.source_id
      WHERE ps.profile_id = profile_uuid AND s.is_active = true
      ORDER BY s.name ASC;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Add helpful comments
-- =====================================================

COMMENT ON TABLE profile_sources IS 'Source restrictions per profile for parental controls and access management';
COMMENT ON COLUMN profile_sources.added_at IS 'When this source was added to the profile';
COMMENT ON COLUMN profile_sources.added_by IS 'Which profile added this source (for audit trail)';
COMMENT ON COLUMN profile_sources.notes IS 'Optional notes about why this source is restricted/allowed';

COMMENT ON FUNCTION get_account_sources IS 'Get all active sources for an account';
COMMENT ON FUNCTION get_profile_sources IS 'Get sources accessible to a specific profile based on restrictions';

-- Step 4: Create audit view for profile source changes
-- =====================================================

CREATE OR REPLACE VIEW profile_source_audit AS
SELECT 
  p.id as profile_id,
  p.name as profile_name,
  p.account_id,
  s.id as source_id,
  s.name as source_name,
  s.provider_type,
  ps.added_at,
  ps.added_by,
  ps.notes,
  CASE 
    WHEN ps.added_by IS NOT NULL THEN 'explicitly_allowed'
    ELSE 'inherited'
  END as access_type
FROM profiles p
LEFT JOIN profile_sources ps ON p.id = ps.profile_id
LEFT JOIN sources s ON ps.source_id = s.id
WHERE p.has_source_restrictions = true
ORDER BY p.name, s.name;

COMMENT ON VIEW profile_source_audit IS 'Audit view showing which sources each profile can access and how';

-- Step 5: Log migration completion
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Profile source management enhancement migration completed successfully';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Enhanced profile_sources table with metadata';
  RAISE NOTICE '  - Added helper functions for source management';
  RAISE NOTICE '  - Created audit view for profile source access';
  RAISE NOTICE '  - Improved source restriction management capabilities';
END $$;
