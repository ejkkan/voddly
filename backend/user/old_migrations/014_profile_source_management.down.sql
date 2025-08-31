-- =====================================================
-- PROFILE SOURCE MANAGEMENT ENHANCEMENT - ROLLBACK
-- Description: Reverts profile source management enhancements
-- =====================================================

-- Step 1: Drop the audit view
-- =====================================================
DROP VIEW IF EXISTS profile_source_audit;

-- Step 2: Drop the helper functions
-- =====================================================
DROP FUNCTION IF EXISTS get_account_sources(UUID);
DROP FUNCTION IF EXISTS get_profile_sources(UUID);

-- Step 3: Remove the additional columns from profile_sources
-- =====================================================
ALTER TABLE profile_sources 
  DROP COLUMN IF EXISTS added_at,
  DROP COLUMN IF EXISTS added_by,
  DROP COLUMN IF EXISTS notes;

-- Step 4: Drop the additional index
-- =====================================================
DROP INDEX IF EXISTS idx_profile_sources_added_at;

-- Step 5: Log rollback completion
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE 'Profile source management enhancement rollback completed successfully';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Removed profile_sources metadata columns';
  RAISE NOTICE '  - Dropped helper functions';
  RAISE NOTICE '  - Dropped audit view';
  RAISE NOTICE '  - Removed additional indexes';
END $$;
