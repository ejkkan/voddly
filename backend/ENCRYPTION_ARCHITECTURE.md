# Improved Encryption Architecture for Voddly

## Current Architecture Issues
- Master key is encrypted with user's passphrase-derived key
- Cannot use external KMS for master key storage
- If user forgets passphrase, data is permanently lost
- Low PBKDF2 iterations (10,000) make brute-force attacks feasible

## Proposed Architecture: Hybrid KMS + User Passphrase

### Overview
```
┌─────────────────────────────────────────────────────────┐
│                     KMS/HSM Service                      │
│                  (AWS KMS, Vault, etc.)                  │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │        Server Master Key (SMK)                   │   │
│  │     (Never leaves KMS, rotated yearly)           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                            │ Encrypts
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Data Encryption Key (DEK)                   │
│         (Unique per account, stored encrypted)           │
└─────────────────────────────────────────────────────────┘
                            │
                            │ Protected by
                            ▼
┌─────────────────────────────────────────────────────────┐
│           User Key Encryption Key (KEK)                  │
│    (Derived from passphrase via Argon2id/PBKDF2)        │
└─────────────────────────────────────────────────────────┘
                            │
                            │ Encrypts
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    User Data                             │
│        (Sources, Credentials, PII if needed)             │
└─────────────────────────────────────────────────────────┘
```

### Key Hierarchy

1. **Server Master Key (SMK)**
   - Stored in KMS/HSM (never in database)
   - Used to encrypt all DEKs
   - Can be rotated without user interaction
   - Provides defense against database dumps

2. **Data Encryption Key (DEK)**
   - Unique per account
   - Encrypted by BOTH:
     - Server Master Key (SMK)
     - User's Key Encryption Key (KEK)
   - Double-wrapped for security

3. **Key Encryption Key (KEK)**
   - Derived from user's passphrase
   - Never stored (computed on-demand)
   - Uses Argon2id or high-iteration PBKDF2

### Implementation Code Structure

```typescript
// Option 1: Hybrid Approach (Recommended)
interface EncryptionKeys {
  // Stored in database
  dek_encrypted_by_smk: string;    // DEK encrypted by Server Master Key
  dek_encrypted_by_kek: string;    // DEK encrypted by user's KEK
  kek_salt: string;                // Salt for deriving KEK from passphrase
  kek_params: {                    // KDF parameters
    algorithm: 'argon2id' | 'pbkdf2';
    iterations?: number;
    memory?: number;
    parallelism?: number;
  };
  dek_iv: string;                  // IV for DEK encryption
}

// Encryption flow
async function encryptUserData(data: any, passphrase: string) {
  // 1. Generate DEK (Data Encryption Key)
  const dek = crypto.randomBytes(32);
  
  // 2. Get Server Master Key from KMS
  const smk = await kms.getKey('server-master-key-id');
  
  // 3. Encrypt DEK with SMK
  const dekEncryptedBySMK = await kms.encrypt(smk, dek);
  
  // 4. Derive KEK from user passphrase
  const salt = crypto.randomBytes(16);
  const kek = await deriveKey(passphrase, salt, {
    algorithm: 'argon2id',
    memory: 65536,
    iterations: 3,
    parallelism: 4
  });
  
  // 5. Encrypt DEK with KEK
  const dekEncryptedByKEK = encrypt(dek, kek);
  
  // 6. Encrypt actual data with DEK
  const encryptedData = encrypt(data, dek);
  
  // 7. Store both encrypted DEKs
  return {
    encryptedData,
    dekEncryptedBySMK,
    dekEncryptedByKEK,
    salt
  };
}

// Decryption flow
async function decryptUserData(encryptedData: any, passphrase: string) {
  // 1. Retrieve both encrypted DEKs
  const { dekEncryptedBySMK, dekEncryptedByKEK, salt } = getKeys();
  
  // 2. Derive KEK from passphrase
  const kek = await deriveKey(passphrase, salt);
  
  // 3. Try to decrypt DEK with KEK first
  let dek;
  try {
    dek = decrypt(dekEncryptedByKEK, kek);
  } catch (e) {
    // Wrong passphrase
    throw new Error('Invalid passphrase');
  }
  
  // 4. Verify DEK by decrypting with SMK (optional double-check)
  const smk = await kms.getKey('server-master-key-id');
  const dekFromSMK = await kms.decrypt(smk, dekEncryptedBySMK);
  
  if (!dek.equals(dekFromSMK)) {
    throw new Error('Key integrity check failed');
  }
  
  // 5. Decrypt data with DEK
  return decrypt(encryptedData, dek);
}
```

## Option 2: Pure Server-Side Encryption (Simpler but Less User Control)

```typescript
// All encryption uses server-managed keys
interface ServerSideEncryption {
  account_id: string;
  dek_encrypted: string;  // DEK encrypted by KMS master key
  data_iv: string;
  // No user passphrase involved
}

// Pros:
// - Simpler implementation
// - Can recover data if user forgets password
// - Easier key rotation
// - Better performance

// Cons:
// - No user-controlled encryption
// - Server admin could decrypt everything
// - Less privacy-focused
```

## Option 3: End-to-End Encryption (Maximum Security)

```typescript
// Client-side encryption, server never sees keys
interface E2EEncryption {
  // Client derives key from passphrase
  // Client encrypts data
  // Server only stores encrypted blobs
  encrypted_blob: string;
  client_salt: string;
  client_iv: string;
  // Server cannot decrypt
}

// Pros:
// - Maximum privacy
// - Zero-knowledge architecture
// - Server compromise doesn't expose data

// Cons:
// - Complex client implementation
// - No server-side features (search, etc.)
// - Data permanently lost if passphrase forgotten
```

## Migration Path from Current Architecture

### Step 1: Add KMS Integration
```typescript
// Add KMS service
class KMSService {
  private client: AWS.KMS | VaultClient;
  
  async generateDataKey(): Promise<{plaintext: Buffer, encrypted: Buffer}> {
    // Generate DEK and return both plaintext and encrypted versions
  }
  
  async decrypt(encryptedKey: Buffer): Promise<Buffer> {
    // Decrypt DEK using master key in KMS
  }
}
```

### Step 2: Update Database Schema
```sql
-- Add new columns for hybrid encryption
ALTER TABLE account_encryption ADD COLUMN dek_encrypted_by_smk TEXT;
ALTER TABLE account_encryption ADD COLUMN kms_key_id TEXT;
ALTER TABLE account_encryption ADD COLUMN encryption_version INT DEFAULT 1;

-- For migration tracking
ALTER TABLE account_encryption ADD COLUMN migrated_at TIMESTAMP;
```

### Step 3: Dual-Write During Migration
```typescript
// Write both old and new format during transition
async function migrateEncryption(accountId: string, passphrase: string) {
  // 1. Decrypt with old method
  const data = await decryptOldMethod(accountId, passphrase);
  
  // 2. Re-encrypt with new hybrid method
  const encrypted = await encryptHybridMethod(data, passphrase);
  
  // 3. Store new encryption metadata
  await updateEncryptionKeys(accountId, encrypted);
}
```

## Security Improvements

### 1. Key Derivation Function Upgrade
```typescript
// Replace PBKDF2 with Argon2id
import { argon2id } from '@noble/hashes/argon2';

const deriveKey = async (passphrase: string, salt: Buffer) => {
  return argon2id(passphrase, salt, {
    t: 3,        // iterations
    m: 65536,    // 64MB memory
    p: 4,        // parallelism
    dkLen: 32    // 256-bit key
  });
};
```

### 2. Add Hardware Security Module Support
```typescript
// Support for hardware key storage
interface HSMProvider {
  generateKey(): Promise<string>;
  encrypt(keyId: string, data: Buffer): Promise<Buffer>;
  decrypt(keyId: string, data: Buffer): Promise<Buffer>;
  rotateKey(keyId: string): Promise<string>;
}
```

### 3. Implement Key Rotation
```typescript
// Automated key rotation
async function rotateKeys() {
  // 1. Generate new SMK in KMS
  const newSMK = await kms.generateKey();
  
  // 2. Re-encrypt all DEKs with new SMK
  for (const account of accounts) {
    const dek = await kms.decrypt(account.dek_encrypted_by_smk);
    account.dek_encrypted_by_smk = await kms.encrypt(newSMK, dek);
  }
  
  // 3. Mark old key for deletion after grace period
  await kms.scheduleKeyDeletion(oldSMK, 30); // 30 days
}
```

## Recommended Implementation Priority

1. **Immediate** (Security Critical):
   - Increase PBKDF2 to 100,000+ iterations
   - Add rate limiting on decryption attempts
   - Implement audit logging

2. **Short Term** (1-2 weeks):
   - Integrate with KMS (AWS KMS or HashiCorp Vault)
   - Implement hybrid encryption model
   - Add encryption version tracking

3. **Medium Term** (1 month):
   - Migrate to Argon2id
   - Implement key rotation
   - Add monitoring and alerting

4. **Long Term** (3 months):
   - Consider E2E encryption for sensitive data
   - Implement searchable encryption for emails
   - Add compliance reporting (GDPR, HIPAA)

## Environment Variables Needed

```env
# KMS Configuration
KMS_PROVIDER=aws  # or 'vault', 'azure', 'gcp'
AWS_KMS_KEY_ID=arn:aws:kms:region:account:key/xxx
AWS_KMS_REGION=us-east-1

# Or for HashiCorp Vault
VAULT_ADDR=https://vault.example.com
VAULT_TOKEN=xxx
VAULT_TRANSIT_PATH=transit/keys/voddly

# Encryption Settings
ENCRYPTION_VERSION=2  # Track encryption scheme version
KDF_ALGORITHM=argon2id
ARGON2_MEMORY_KB=65536
ARGON2_ITERATIONS=3
ARGON2_PARALLELISM=4
```

## Testing Strategy

1. **Unit Tests**: Test each encryption/decryption function
2. **Integration Tests**: Test full flow with KMS
3. **Migration Tests**: Ensure backward compatibility
4. **Performance Tests**: Measure impact of Argon2id
5. **Security Tests**: Penetration testing, key rotation

## Monitoring and Alerts

```typescript
// Track encryption operations
interface EncryptionMetrics {
  encryptionLatency: Histogram;
  decryptionLatency: Histogram;
  kmsErrors: Counter;
  keyRotations: Counter;
  failedDecryptions: Counter;
}

// Alert on suspicious activity
if (failedDecryptions > 10) {
  alert('Possible brute force attempt');
  lockAccount(accountId);
}
```