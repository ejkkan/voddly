-- Accounts, Members, Sources, Secrets (ciphertext-only), Key Wraps, and User Content State

-- Accounts: sharing/billing boundary
CREATE TABLE IF NOT EXISTS app_account (
  id UUID PRIMARY KEY,
  owner_user_id VARCHAR(255) REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT,
  plan TEXT,
  status TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Account membership: users belong to accounts
CREATE TABLE IF NOT EXISTS app_account_member (
  account_id UUID REFERENCES app_account(id) ON DELETE CASCADE,
  user_id VARCHAR(255) REFERENCES "user"(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner','admin','member','viewer')) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_account_member_user ON app_account_member(user_id);

-- Sources: non-sensitive metadata only. Do not store raw hostnames/URLs here.
CREATE TABLE IF NOT EXISTS app_account_source (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES app_account(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL,      -- e.g. 'xtream' | 'm3u' | 'epg'
  label TEXT NOT NULL,
  status TEXT,
  priority INT DEFAULT 100,
  secret_id UUID,                   -- FK to app_account_secret.id (nullable until attached)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_source_account ON app_account_source(account_id);

-- Ciphertext-only secret blobs (client-side encrypted)
CREATE TABLE IF NOT EXISTS app_account_secret (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES app_account(id) ON DELETE CASCADE,
  type TEXT NOT NULL,               -- 'xtream_credentials' | 'm3u_url' | ...
  name TEXT,
  ciphertext BYTEA NOT NULL,
  nonce BYTEA NOT NULL,
  wrapped_dek BYTEA NOT NULL,
  wrapped_dek_nonce BYTEA NOT NULL,
  cipher_algo TEXT NOT NULL,        -- 'aes-gcm-256' | 'xchacha20poly1305'
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_secret_account ON app_account_secret(account_id);

-- Per-member wrapped Account Vault Key (AVK)
CREATE TABLE IF NOT EXISTS app_account_key_wrap (
  account_id UUID REFERENCES app_account(id) ON DELETE CASCADE,
  user_id VARCHAR(255) REFERENCES "user"(id) ON DELETE CASCADE,
  wrapped_avk BYTEA NOT NULL,
  wrap_iv BYTEA NOT NULL,
  kdf_algo TEXT,
  kdf_salt BYTEA,
  kdf_params JSONB,
  wrap_algo TEXT NOT NULL,          -- 'aes-gcm-256' | 'nacl.box' | ...
  PRIMARY KEY (account_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_key_wrap_user ON app_account_key_wrap(user_id);

-- Per-user, per-account content state using opaque keys (no raw URLs/IDs)
CREATE TABLE IF NOT EXISTS user_content_state (
  user_id VARCHAR(255) REFERENCES "user"(id) ON DELETE CASCADE,
  account_id UUID REFERENCES app_account(id) ON DELETE CASCADE,
  content_key TEXT NOT NULL,
  is_favorite BOOLEAN DEFAULT FALSE,
  last_position_seconds INT,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, account_id, content_key)
);

CREATE INDEX IF NOT EXISTS idx_state_user_account ON user_content_state(user_id, account_id);


