-- Fix the owner profile that was incorrectly set to is_owner = false
-- This updates the Main profile for your subscription to be the owner

UPDATE profiles 
SET is_owner = true 
WHERE subscription_id = '6421e598-9e9f-41d3-b866-41379f713127' 
  AND name = 'Main';

-- Verify the fix
SELECT id, name, is_owner, subscription_id 
FROM profiles 
WHERE subscription_id = '6421e598-9e9f-41d3-b866-41379f713127';