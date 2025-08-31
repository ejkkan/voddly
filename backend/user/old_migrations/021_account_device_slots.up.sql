-- Add device_slots field to accounts table
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS device_slots INTEGER DEFAULT 3;

-- Update existing accounts based on their subscription tier
UPDATE accounts 
SET device_slots = CASE 
  WHEN subscription_tier = 'premium' THEN 10
  WHEN subscription_tier = 'standard' THEN 5
  WHEN subscription_tier = 'basic' THEN 3
  ELSE 3
END
WHERE device_slots IS NULL;

-- Add constraint to ensure device_slots is positive
ALTER TABLE accounts 
ADD CONSTRAINT check_device_slots_positive 
CHECK (device_slots > 0);