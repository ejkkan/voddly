-- Rename accounts table to user_subscription and remove unnecessary fields
-- This clarifies that this table is for subscription/billing, not authentication

-- Step 1: Rename the table
ALTER TABLE accounts RENAME TO user_subscription;

-- Step 2: Drop unnecessary columns
ALTER TABLE user_subscription 
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS plan,
  DROP COLUMN IF EXISTS status;

-- Step 3: Add updated_at column if it doesn't exist
ALTER TABLE user_subscription 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Step 4: Update foreign key constraints in dependent tables
-- Update profiles table
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_account_id_fkey;
ALTER TABLE profiles 
  ADD CONSTRAINT profiles_subscription_id_fkey 
  FOREIGN KEY (account_id) REFERENCES user_subscription(id) ON DELETE CASCADE;

-- Rename the column in profiles for clarity
ALTER TABLE profiles 
  RENAME COLUMN account_id TO subscription_id;

-- Update sources table
ALTER TABLE sources 
  DROP CONSTRAINT IF EXISTS sources_account_id_fkey;
ALTER TABLE sources 
  ADD CONSTRAINT sources_subscription_id_fkey 
  FOREIGN KEY (account_id) REFERENCES user_subscription(id) ON DELETE CASCADE;

-- Rename the column in sources for clarity
ALTER TABLE sources 
  RENAME COLUMN account_id TO subscription_id;

-- Update account_encryption table
ALTER TABLE account_encryption 
  RENAME TO subscription_encryption;

ALTER TABLE subscription_encryption 
  DROP CONSTRAINT IF EXISTS account_encryption_account_id_fkey;
ALTER TABLE subscription_encryption 
  ADD CONSTRAINT subscription_encryption_subscription_id_fkey 
  FOREIGN KEY (account_id) REFERENCES user_subscription(id) ON DELETE CASCADE;

-- Rename the column for clarity
ALTER TABLE subscription_encryption 
  RENAME COLUMN account_id TO subscription_id;

-- Update account_devices table
ALTER TABLE account_devices 
  RENAME TO subscription_devices;

ALTER TABLE subscription_devices 
  DROP CONSTRAINT IF EXISTS account_devices_account_id_fkey;
ALTER TABLE subscription_devices 
  ADD CONSTRAINT subscription_devices_subscription_id_fkey 
  FOREIGN KEY (account_id) REFERENCES user_subscription(id) ON DELETE CASCADE;

-- Rename the column for clarity
ALTER TABLE subscription_devices 
  RENAME COLUMN account_id TO subscription_id;

-- Update profile_sources table (no account_id here, but check for consistency)
-- profile_sources only has profile_id and source_id, so no changes needed

-- Update profile_watch_state table (no account_id here either)
-- profile_watch_state only has profile_id, so no changes needed

-- Step 5: Update indexes
DROP INDEX IF EXISTS idx_profiles_account;
CREATE INDEX idx_profiles_subscription ON profiles(subscription_id);

DROP INDEX IF EXISTS idx_sources_account;
CREATE INDEX idx_sources_subscription ON sources(subscription_id);

-- Step 6: Add better comments
COMMENT ON TABLE user_subscription IS 'User subscription and billing information - 1:1 with users';
COMMENT ON COLUMN user_subscription.user_id IS 'One subscription per user (1:1 relationship)';
COMMENT ON COLUMN user_subscription.subscription_tier IS 'Subscription level: basic, standard, or premium';
COMMENT ON COLUMN user_subscription.subscription_status IS 'Current subscription status';
COMMENT ON COLUMN user_subscription.device_slots IS 'Number of devices allowed for this subscription';
COMMENT ON COLUMN user_subscription.stripe_customer_id IS 'Stripe customer ID for billing';

COMMENT ON TABLE subscription_encryption IS 'Encryption keys for each subscription';
COMMENT ON TABLE subscription_devices IS 'Registered devices per subscription';
COMMENT ON TABLE profiles IS 'User profiles within a subscription (Netflix-style)';
COMMENT ON TABLE sources IS 'Media sources attached to a subscription';

-- Step 7: Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_subscription_updated_at ON user_subscription;
CREATE TRIGGER update_user_subscription_updated_at 
    BEFORE UPDATE ON user_subscription 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Successfully renamed accounts to user_subscription and cleaned up structure';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '  - Renamed accounts → user_subscription';
  RAISE NOTICE '  - Removed unnecessary columns: name, plan, status';
  RAISE NOTICE '  - Updated all foreign key references';
  RAISE NOTICE '  - Renamed related tables for consistency';
END $$;