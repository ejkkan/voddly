# Security Setup Guide

## Setting Up Enhanced Encryption

The application now uses double-layer encryption for maximum security:
- **Layer 1**: User passphrase (500,000 PBKDF2 iterations)
- **Layer 2**: Server-side secret (Encore secret management)

### 1. Generate Master Encryption Secret

Generate a strong random secret:
```bash
openssl rand -base64 32
```

### 2. Set the Secret in Encore

For development:
```bash
encore secret set --type dev MasterEncryptionSecret
# Paste the generated secret when prompted
```

For production:
```bash
encore secret set --type prod MasterEncryptionSecret
# Paste the generated secret when prompted
```

For both environments at once:
```bash
encore secret set --type dev,prod MasterEncryptionSecret
```

### 3. Run Database Migration

The migration adds support for the enhanced encryption:
```bash
encore db migrate user
```

### 4. Verify Setup

Check that the secret is set:
```bash
encore secret list
```

You should see `MasterEncryptionSecret` in the list.

## Security Features

### Enhanced Key Derivation
- **500,000 PBKDF2 iterations** (up from 10,000)
- Takes 2-5 seconds on average hardware
- Makes brute force attacks 50x harder

### Double-Layer Encryption
- User data is encrypted with user's passphrase
- Then encrypted again with server secret
- Attacker needs BOTH to decrypt

### Backward Compatibility
- Old users (10k iterations) work without changes
- Automatically upgraded on next login
- No downtime or data migration needed

### Security Improvements
- **Before**: 10k iterations, single layer
- **After**: 500k iterations, double layer
- **Total**: ~100x harder to crack

## Important Notes

1. **Never commit the secret** to version control
2. **Back up the secret** securely - losing it means data loss
3. **Use different secrets** for dev and prod environments
4. **Rotate periodically** (every 6-12 months)

## Troubleshooting

If you see this error:
```
[ServerEncryption] WARNING: MasterEncryptionSecret not set!
```

Run:
```bash
encore secret set --type dev MasterEncryptionSecret
```

## Monitoring

The system logs key operations:
- `[Security] Deriving key with 500k iterations...`
- `[ServerEncryption] Server encryption initialized`
- `[Decrypt] Using double-layer encryption (v2)`
- `[Upgrade] Upgrading account encryption...`

Check logs with:
```bash
encore logs --env dev
```