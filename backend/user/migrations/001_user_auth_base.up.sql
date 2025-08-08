-- User Authentication Base Migration
-- Description: Creates core authentication tables - user, session, account, and verification

-- Core user table with auth, admin, and subscription fields
CREATE TABLE "user"
(
    -- Core user fields
    "id"               VARCHAR(255) PRIMARY KEY NOT NULL,                           -- Unique identifier for each user
    "name"             VARCHAR(255)             NOT NULL,                           -- User's chosen display name
    "email"            VARCHAR(255)             NOT NULL UNIQUE,                    -- User's email address for communication and login
    "emailVerified"    BOOLEAN                  NOT NULL DEFAULT FALSE,             -- Whether the user's email is verified
    "image"            VARCHAR(255),                                                -- User's profile image URL (optional)
    "createdAt"        TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Timestamp of when the user account was created
    "updatedAt"        TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Timestamp of the last update to the user's information

    -- Stripe plugin fields
    "stripeCustomerId" VARCHAR(255),                                                -- Stripe customer ID for the user (if applicable)

    -- Admin plugin fields
    "role"             VARCHAR(255)                      DEFAULT 'user',            -- User's role (user, admin, etc.). Defaults to 'user'. Admins will have the 'admin' role.
    "banned"           BOOLEAN                           DEFAULT FALSE,             -- Indicates whether the user is banned from the platform
    "banReason"        TEXT,                                                        -- The reason provided for the user's ban (if applicable)
    "banExpires"       BIGINT,                                                      -- Unix timestamp when the user's ban will expire (if temporary)

    -- Subscription fields
    "subscription_tier" VARCHAR(50) DEFAULT 'free',                                 -- User's subscription tier
    "subscription_status" VARCHAR(50),                                              -- Current subscription status
    "subscription_id" VARCHAR(255),                                                 -- Reference to subscription
    "subscription_current_period_end" TIMESTAMP                                     -- When current subscription period ends
);

-- Session table for authentication
CREATE TABLE "session"
(
    -- Core session fields
    "id"             VARCHAR(255) PRIMARY KEY NOT NULL,                           -- Unique identifier for each session
    "userId"         VARCHAR(255)             NOT NULL,                           -- The id of the user who owns this session
    "token"          VARCHAR(255)             NOT NULL UNIQUE,                    -- The unique session token used for authentication
    "expiresAt"      TIMESTAMP                NOT NULL,                           -- The time when the session expires
    "ipAddress"      VARCHAR(45),                                                 -- The IP address of the device that created the session
    "userAgent"      TEXT,                                                        -- The user agent information of the device
    "createdAt"      TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Timestamp of when the session was created
    "updatedAt"      TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Timestamp of when the session was last updated

    -- Admin plugin field
    "impersonatedBy" VARCHAR(255),                                                -- The ID of the admin that is impersonating this session

    -- Foreign key constraint
    FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
);

-- Account table for OAuth providers and credentials
CREATE TABLE "account"
(
    -- Core account fields
    "id"                    VARCHAR(255) PRIMARY KEY NOT NULL,                           -- Unique identifier for each account
    "userId"                VARCHAR(255)             NOT NULL,                           -- The id of the user who owns this account
    "accountId"             VARCHAR(255)             NOT NULL,                           -- The id of the account as provided by the SSO or equal to userId for credential accounts
    "providerId"            VARCHAR(255)             NOT NULL,                           -- The id of the provider (e.g., 'google', 'github', 'credentials')
    "accessToken"           TEXT,                                                        -- The access token of the account returned by the provider
    "refreshToken"          TEXT,                                                        -- The refresh token of the account returned by the provider
    "accessTokenExpiresAt"  TIMESTAMP,                                                   -- The time when the access token expires
    "refreshTokenExpiresAt" TIMESTAMP,                                                   -- The time when the refresh token expires
    "scope"                 TEXT,                                                        -- The scope of the account returned by the provider
    "idToken"               TEXT,                                                        -- The id token returned from the provider
    "password"              VARCHAR(255),                                                -- The password of the account (hashed), mainly used for email and password authentication
    "createdAt"             TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Timestamp of when the account was created
    "updatedAt"             TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Timestamp of when the account was last updated

    -- Foreign key constraint
    FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
);

-- Verification table for managing verification tokens
CREATE TABLE "verification"
(
    -- Core verification fields
    "id"         VARCHAR(255) PRIMARY KEY NOT NULL,                           -- Unique identifier for each verification
    "identifier" VARCHAR(255)             NOT NULL,                           -- The identifier for the verification request (typically email address or user ID)
    "value"      TEXT                     NOT NULL,                           -- The verification token/code/value to be verified
    "expiresAt"  TIMESTAMP                NOT NULL,                           -- The time when the verification request expires
    "createdAt"  TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Timestamp of when the verification request was created
    "updatedAt"  TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP  -- Timestamp of when the verification request was updated
);

-- Create indexes for user table
CREATE INDEX idx_user_email ON "user" ("email");
CREATE INDEX idx_user_role ON "user" ("role");
CREATE INDEX idx_user_banned ON "user" ("banned");
CREATE INDEX idx_user_stripe_customer ON "user" ("stripeCustomerId");
CREATE INDEX idx_user_subscription_tier ON "user" ("subscription_tier");
CREATE INDEX idx_user_subscription_status ON "user" ("subscription_status");
CREATE INDEX idx_user_subscription_id ON "user" ("subscription_id");

-- Create indexes for session table
CREATE INDEX idx_session_token ON "session" ("token");
CREATE INDEX idx_session_userId ON "session" ("userId");
CREATE INDEX idx_session_expiresAt ON "session" ("expiresAt");
CREATE INDEX idx_session_impersonatedBy ON "session" ("impersonatedBy");

-- Create indexes for account table
CREATE UNIQUE INDEX idx_account_provider_account ON "account" ("providerId", "accountId");
CREATE INDEX idx_account_userId ON "account" ("userId");
CREATE INDEX idx_account_providerId ON "account" ("providerId");
CREATE INDEX idx_account_accessTokenExpiresAt ON "account" ("accessTokenExpiresAt");

-- Create indexes for verification table
CREATE INDEX idx_verification_identifier ON "verification" ("identifier");
CREATE INDEX idx_verification_value ON "verification" ("value");
CREATE INDEX idx_verification_expiresAt ON "verification" ("expiresAt");
CREATE INDEX idx_verification_identifier_value ON "verification" ("identifier", "value");

-- Add check constraint for valid subscription tiers
ALTER TABLE "user" 
ADD CONSTRAINT chk_subscription_tier 
CHECK ("subscription_tier" IN ('free', 'basic', 'pro', 'enterprise'));

-- Create function to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for user table updatedAt
CREATE TRIGGER update_user_updated_at 
    BEFORE UPDATE ON "user" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 