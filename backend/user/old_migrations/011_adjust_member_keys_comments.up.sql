-- Update member_keys comments to reflect Argon2id-only scheme
COMMENT ON COLUMN member_keys.salt IS 'Salt for Argon2id key derivation';
COMMENT ON COLUMN member_keys.iterations IS 'Legacy PBKDF2 iterations (unused)';
COMMENT ON COLUMN member_keys.kdf IS 'Key derivation function (argon2id)';
COMMENT ON COLUMN member_keys.opslimit IS 'Argon2id time cost (ops)';
COMMENT ON COLUMN member_keys.memlimit IS 'Argon2id memory cost in bytes';
COMMENT ON COLUMN member_keys.wrap_algo IS 'Key wrap algorithm (aes-gcm-256)';

