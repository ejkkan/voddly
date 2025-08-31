-- =====================================================
-- Better-Auth Base Tables
-- Description: Core authentication tables for better-auth
-- =====================================================

-- Core user table with auth fields
CREATE TABLE "user"
(
    -- Core user fields
    "id"               VARCHAR(255) PRIMARY KEY NOT NULL,
    "name"             VARCHAR(255)             NOT NULL,
    "email"            VARCHAR(255)             NOT NULL UNIQUE,
    "emailVerified"    BOOLEAN                  NOT NULL DEFAULT FALSE,
    "image"            VARCHAR(255),
    "createdAt"        TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Admin plugin fields
    "role"             VARCHAR(255)                      DEFAULT 'user',
    "banned"           BOOLEAN                           DEFAULT FALSE,
    "banReason"        TEXT,
    "banExpires"       BIGINT
);

-- Session table for authentication
CREATE TABLE "session"
(
    -- Core session fields
    "id"             VARCHAR(255) PRIMARY KEY NOT NULL,
    "userId"         VARCHAR(255)             NOT NULL,
    "token"          VARCHAR(255)             NOT NULL UNIQUE,
    "expiresAt"      TIMESTAMP                NOT NULL,
    "ipAddress"      VARCHAR(45),
    "userAgent"      TEXT,
    "createdAt"      TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Admin plugin field
    "impersonatedBy" VARCHAR(255),

    -- Foreign key constraint
    FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
);

-- Account table for OAuth providers and credentials
CREATE TABLE "account"
(
    -- Core account fields
    "id"                    VARCHAR(255) PRIMARY KEY NOT NULL,
    "userId"                VARCHAR(255)             NOT NULL,
    "accountId"             VARCHAR(255)             NOT NULL,
    "providerId"            VARCHAR(255)             NOT NULL,
    "accessToken"           TEXT,
    "refreshToken"          TEXT,
    "accessTokenExpiresAt"  TIMESTAMP,
    "refreshTokenExpiresAt" TIMESTAMP,
    "scope"                 TEXT,
    "idToken"               TEXT,
    "password"              VARCHAR(255),
    "createdAt"             TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint
    FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
);

-- Verification table for managing verification tokens
CREATE TABLE "verification"
(
    -- Core verification fields
    "id"         VARCHAR(255) PRIMARY KEY NOT NULL,
    "identifier" VARCHAR(255)             NOT NULL,
    "value"      TEXT                     NOT NULL,
    "expiresAt"  TIMESTAMP                NOT NULL,
    "createdAt"  TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for user table
CREATE INDEX idx_user_email ON "user" ("email");
CREATE INDEX idx_user_role ON "user" ("role");
CREATE INDEX idx_user_banned ON "user" ("banned");

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

-- Create function to update updatedAt timestamp (for camelCase columns)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create function to update updated_at timestamp (for snake_case columns)
CREATE OR REPLACE FUNCTION update_updated_at_column_snake()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for user table updatedAt
CREATE TRIGGER update_user_updated_at 
    BEFORE UPDATE ON "user" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for session table updatedAt
CREATE TRIGGER update_session_updated_at 
    BEFORE UPDATE ON "session" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for account table updatedAt
CREATE TRIGGER update_account_updated_at 
    BEFORE UPDATE ON "account" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for verification table updatedAt
CREATE TRIGGER update_verification_updated_at 
    BEFORE UPDATE ON "verification" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();