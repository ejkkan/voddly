-- =====================================================
-- User Subscription and Profiles System
-- Description: Netflix-style subscription with profiles
-- =====================================================

-- User subscription table (1:1 with users)
CREATE TABLE user_subscription (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
    
    -- Subscription details
    subscription_tier VARCHAR(50) DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'standard', 'premium')),
    subscription_status VARCHAR(50) DEFAULT 'active',
    subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    subscription_current_period_end TIMESTAMP,
    
    -- Device management
    device_slots INTEGER DEFAULT 2,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Profiles table (Netflix-style, multiple per subscription)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES user_subscription(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    has_source_restrictions BOOLEAN DEFAULT FALSE,
    is_owner BOOLEAN DEFAULT FALSE,
    is_kids_profile BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subscription_id, name)
);

-- Indexes for user_subscription
CREATE INDEX idx_user_subscription_user ON user_subscription(user_id);
CREATE INDEX idx_user_subscription_tier ON user_subscription(subscription_tier);
CREATE INDEX idx_user_subscription_status ON user_subscription(subscription_status);
CREATE INDEX idx_user_subscription_stripe ON user_subscription(stripe_customer_id);

-- Indexes for profiles
CREATE INDEX idx_profiles_subscription ON profiles(subscription_id);
CREATE INDEX idx_profiles_owner ON profiles(subscription_id, is_owner) WHERE is_owner = TRUE;

-- Triggers for updated_at
CREATE TRIGGER update_user_subscription_updated_at 
    BEFORE UPDATE ON user_subscription 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column_snake();

CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column_snake();

-- Comments
COMMENT ON TABLE user_subscription IS 'User subscription information - 1:1 with users';
COMMENT ON COLUMN user_subscription.subscription_tier IS 'Determines limits: basic=2 devices, standard=4, premium=6';
COMMENT ON COLUMN user_subscription.device_slots IS 'Number of devices allowed for this subscription';

COMMENT ON TABLE profiles IS 'Netflix-style profiles within a subscription';
COMMENT ON COLUMN profiles.has_source_restrictions IS 'If true, profile can only access sources in profile_sources table';
COMMENT ON COLUMN profiles.is_kids_profile IS 'Indicates if this is a kids-restricted profile';