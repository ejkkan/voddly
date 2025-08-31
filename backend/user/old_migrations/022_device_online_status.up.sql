-- Add online status tracking for devices
ALTER TABLE account_devices 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create index for active device queries
CREATE INDEX IF NOT EXISTS idx_account_devices_active 
ON account_devices(account_id, last_used) 
WHERE is_active = true;

-- Update existing devices to be active if used recently (within 10 minutes)
UPDATE account_devices 
SET is_active = CASE 
  WHEN last_used > NOW() - INTERVAL '10 minutes' THEN true
  ELSE false
END
WHERE is_active IS NULL;