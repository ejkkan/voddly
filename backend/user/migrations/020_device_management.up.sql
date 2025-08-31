-- Add device management fields
ALTER TABLE account_devices 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP;

-- Create index for active device queries
CREATE INDEX IF NOT EXISTS idx_account_devices_active 
ON account_devices(account_id, is_active) 
WHERE is_active = true;

-- Update existing devices to be active
UPDATE account_devices 
SET is_active = true 
WHERE is_active IS NULL;