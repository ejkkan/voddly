# Final Migration Verification Checklist

## User Service - Complete Schema Review

### ✅ Authentication (001_better_auth_base.up.sql)
- [x] `user` table with all fields
- [x] `session` table
- [x] `account` table (OAuth/credentials)
- [x] `verification` table
- [x] All indexes and triggers

### ✅ Stripe (002_stripe_subscriptions.up.sql)
- [x] `subscription` table for Stripe billing

### ✅ Subscription & Profiles (003_user_subscription_profiles.up.sql)
- [x] `user_subscription` table (renamed from `accounts`)
- [x] `profiles` table with Netflix-style structure
- [x] One-to-one user to subscription relationship
- [x] Multiple profiles per subscription

### ✅ Media Sources (004_media_sources.up.sql)
- [x] `sources` table (without plain text credentials)
- [x] `profile_sources` for parental controls
- [x] Source types: xtream, m3u, stalker, webdav

### ✅ Encryption (005_encryption_system.up.sql)
- [x] `subscription_encryption` table with:
  - [x] Master key wrapping
  - [x] Argon2id KDF parameters
  - [x] Enhanced encryption fields (version, upgrade status)
  - [x] Device-specific parameters
- [x] `source_credentials` table for encrypted credentials

### ✅ Watch History (006_watch_history_favorites.up.sql)
- [x] `profile_watch_state` table
- [x] `profile_favorites` table
- [x] All content tracking fields

### ✅ Playlists (007_playlists.up.sql)
- [x] `profile_playlists` table
- [x] `playlist_items` table
- [x] Auto-updating item counts

### ✅ Device Management (008_device_management.up.sql)
- [x] `subscription_devices` table
- [x] `device_sessions` table
- [x] Device limit enforcement
- [x] Online status tracking

### ✅ Subtitles (009_subtitles_cache.up.sql)
- [x] `user_subtitles` table
- [x] `profile_subtitle_preferences` table
- [x] All subtitle metadata fields

### ✅ Security Audit (010_security_audit.up.sql)
- [x] `security_audit_log` table
- [x] Event tracking and categorization

### ✅ Helper Functions (011_helper_functions.up.sql)
- [x] `get_profile_sources()` function
- [x] `can_profile_access_source()` function
- [x] `copy_profile_sources()` function
- [x] `get_profile_stats()` function
- [x] `cleanup_expired_sessions()` function
- [x] `get_active_device_count()` function

## Metadata Service - Complete Schema Review

### ✅ Content Metadata (001_content_metadata.up.sql)
- [x] `content_metadata` table with:
  - [x] All TMDB fields
  - [x] Structured JSONB for cast, crew, images
  - [x] Ratings structure
  - [x] External IDs
  - [x] All optimizations from migration 005

### ✅ Enrichment (002_content_enrichment.up.sql)
- [x] `content_enrichment` table with:
  - [x] OMDB data (IMDB, Metacritic, RT)
  - [x] Fanart.tv image URLs
  - [x] Trakt.tv statistics
  - [x] YouTube trailer info

### ✅ Caching (003_trends_cache.up.sql)
- [x] `trends_cache` table
- [x] `discovery_cache` table (new addition)
- [x] `search_cache` table (new addition)
- [x] Cache cleanup function

### ✅ Subtitles (004_subtitles_metadata.up.sql)
- [x] `subtitles` table (global cache)
- [x] `subtitle_provider_status` table (new addition)
- [x] Provider rate limit tracking

## Tables NOT Included (Intentionally)

These tables were created in intermediate migrations but later dropped/replaced:

1. **`pending_invites`** - Dropped in migration 013 (no longer needed with Netflix-style profiles)
2. **`account_members`** - Dropped in migration 013 (replaced by profiles)
3. **`member_keys`** - Dropped in migration 013 (replaced by subscription_encryption)
4. **`member_watch_state`** - Dropped in migration 013 (replaced by profile_watch_state)
5. **`app_account_*` tables** - Early versions renamed in migration 005
6. **Plain text credentials in sources** - Removed in favor of encrypted storage

## Key Architectural Decisions

1. **Encryption**: All credentials stored in `source_credentials` table, encrypted with subscription master key
2. **Profiles**: Netflix-style profiles replace the complex member/account system
3. **Device Management**: Enforces tier-based limits (basic=2, standard=4, premium=6)
4. **Subtitles**: Dual system - global cache in metadata service, user preferences in user service
5. **Audit Logging**: Security events tracked in dedicated table

## Migration Order

### User Service (11 files)
1. 001_better_auth_base.up.sql
2. 002_stripe_subscriptions.up.sql
3. 003_user_subscription_profiles.up.sql
4. 004_media_sources.up.sql
5. 005_encryption_system.up.sql
6. 006_watch_history_favorites.up.sql
7. 007_playlists.up.sql
8. 008_device_management.up.sql
9. 009_subtitles_cache.up.sql
10. 010_security_audit.up.sql
11. 011_helper_functions.up.sql

### Metadata Service (4 files)
1. 001_content_metadata.up.sql
2. 002_content_enrichment.up.sql
3. 003_trends_cache.up.sql
4. 004_subtitles_metadata.up.sql

## Testing Commands

```bash
# Create test databases
createdb voddly_user_test
createdb voddly_metadata_test

# Apply user service migrations
for file in backend/user/migrations_new/*.sql; do
  echo "Applying $file..."
  psql voddly_user_test < "$file"
done

# Apply metadata service migrations
for file in backend/metadata/migrations_new/*.sql; do
  echo "Applying $file..."
  psql voddly_metadata_test < "$file"
done

# Verify all tables exist
psql voddly_user_test -c "\dt"
psql voddly_metadata_test -c "\dt"

# Check for functions
psql voddly_user_test -c "\df"
```

## Final Notes

The consolidated migrations:
1. Create the exact same final schema as migrations 001-023
2. Are organized logically by feature
3. Include all security and performance optimizations
4. Add helpful improvements (cache tables, audit log, helper functions)
5. Follow consistent naming conventions throughout