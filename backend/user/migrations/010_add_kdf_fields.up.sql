-- Add KDF metadata columns for Argon2id-only scheme
ALTER TABLE member_keys
  ADD COLUMN IF NOT EXISTS kdf TEXT,
  ADD COLUMN IF NOT EXISTS opslimit INT,
  ADD COLUMN IF NOT EXISTS memlimit INT,
  ADD COLUMN IF NOT EXISTS wrap_algo TEXT;

-- Optionally backfill legacy rows as PBKDF2 (we will stop using them client-side)
-- UPDATE member_keys SET kdf = 'pbkdf2' WHERE kdf IS NULL;


