import * as crypto from 'crypto';
import { log } from 'encore.dev/log';

// KMS Provider Interface
interface KMSProvider {
  generateDataKey(keyId: string): Promise<{ plaintext: Buffer; ciphertext: Buffer }>;
  decrypt(keyId: string, ciphertext: Buffer): Promise<Buffer>;
  encrypt(keyId: string, plaintext: Buffer): Promise<Buffer>;
}

// Mock KMS for local development - replace with real KMS in production
class LocalKMSProvider implements KMSProvider {
  private masterKey: Buffer;

  constructor() {
    // In production, this would never exist - key stays in HSM/KMS
    this.masterKey = Buffer.from(
      process.env.LOCAL_MASTER_KEY || crypto.randomBytes(32).toString('hex'),
      'hex'
    );
  }

  async generateDataKey(keyId: string): Promise<{ plaintext: Buffer; ciphertext: Buffer }> {
    const plaintext = crypto.randomBytes(32);
    const ciphertext = await this.encrypt(keyId, plaintext);
    return { plaintext, ciphertext };
  }

  async encrypt(keyId: string, plaintext: Buffer): Promise<Buffer> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
    return Buffer.concat([iv, encrypted]);
  }

  async decrypt(keyId: string, ciphertext: Buffer): Promise<Buffer> {
    const iv = ciphertext.slice(0, 12);
    const authTag = ciphertext.slice(-16);
    const encrypted = ciphertext.slice(12, -16);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
  }
}

// AWS KMS Provider (production)
class AWSKMSProvider implements KMSProvider {
  private kmsKeyId: string;

  constructor(keyId: string) {
    this.kmsKeyId = keyId;
  }

  async generateDataKey(keyId: string): Promise<{ plaintext: Buffer; ciphertext: Buffer }> {
    // Implementation would use AWS SDK
    // const kms = new AWS.KMS();
    // const result = await kms.generateDataKey({
    //   KeyId: this.kmsKeyId,
    //   KeySpec: 'AES_256'
    // }).promise();
    // return {
    //   plaintext: Buffer.from(result.Plaintext),
    //   ciphertext: Buffer.from(result.CiphertextBlob)
    // };
    throw new Error('AWS KMS not implemented - use LocalKMSProvider for development');
  }

  async decrypt(keyId: string, ciphertext: Buffer): Promise<Buffer> {
    // Implementation would use AWS SDK
    throw new Error('AWS KMS not implemented - use LocalKMSProvider for development');
  }

  async encrypt(keyId: string, plaintext: Buffer): Promise<Buffer> {
    // Implementation would use AWS SDK
    throw new Error('AWS KMS not implemented - use LocalKMSProvider for development');
  }
}

// Enhanced encryption service with hybrid approach
export class EncryptionService {
  private kmsProvider: KMSProvider;
  private kdfIterations: number;
  private kdfAlgorithm: 'pbkdf2' | 'argon2id';

  constructor() {
    // Select KMS provider based on environment
    const provider = process.env.KMS_PROVIDER || 'local';
    
    switch (provider) {
      case 'aws':
        this.kmsProvider = new AWSKMSProvider(process.env.AWS_KMS_KEY_ID!);
        break;
      case 'local':
      default:
        this.kmsProvider = new LocalKMSProvider();
        break;
    }

    // KDF configuration
    this.kdfAlgorithm = (process.env.KDF_ALGORITHM as 'pbkdf2' | 'argon2id') || 'pbkdf2';
    this.kdfIterations = parseInt(process.env.KDF_ITERATIONS || '100000', 10);
  }

  /**
   * Derive a key from a passphrase using configured KDF
   */
  async deriveKeyFromPassphrase(
    passphrase: string,
    salt: Buffer,
    params?: {
      algorithm?: 'pbkdf2' | 'argon2id';
      iterations?: number;
      memory?: number;
      parallelism?: number;
    }
  ): Promise<Buffer> {
    const algorithm = params?.algorithm || this.kdfAlgorithm;
    
    if (algorithm === 'argon2id') {
      // For production, use @noble/hashes/argon2
      // const { argon2id } = await import('@noble/hashes/argon2');
      // return Buffer.from(argon2id(passphrase, salt, {
      //   t: params?.iterations || 3,
      //   m: params?.memory || 65536,
      //   p: params?.parallelism || 4,
      //   dkLen: 32
      // }));
      
      // Fallback to PBKDF2 for now
      log.warn('Argon2id not available, falling back to PBKDF2');
    }
    
    // PBKDF2 with higher iterations
    return crypto.pbkdf2Sync(
      passphrase,
      salt,
      params?.iterations || this.kdfIterations,
      32,
      'sha256'
    );
  }

  /**
   * Generate a new Data Encryption Key (DEK) with hybrid protection
   */
  async generateHybridDEK(passphrase: string): Promise<{
    dekPlaintext: Buffer;
    dekEncryptedBySMK: Buffer;
    dekEncryptedByKEK: Buffer;
    kekSalt: Buffer;
    kekIV: Buffer;
    kdfParams: any;
  }> {
    // 1. Generate DEK via KMS (so it's already encrypted by SMK)
    const { plaintext: dekPlaintext, ciphertext: dekEncryptedBySMK } = 
      await this.kmsProvider.generateDataKey('primary');

    // 2. Generate salt and derive KEK from passphrase
    const kekSalt = crypto.randomBytes(16);
    const kek = await this.deriveKeyFromPassphrase(passphrase, kekSalt);

    // 3. Encrypt DEK with KEK (user's passphrase-derived key)
    const kekIV = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', kek, kekIV);
    const encryptedDEK = Buffer.concat([
      cipher.update(dekPlaintext),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    // 4. Clear sensitive data from memory
    dekPlaintext.fill(0);
    kek.fill(0);

    return {
      dekPlaintext: dekPlaintext, // Already zeroed, but needed for initial encryption
      dekEncryptedBySMK,
      dekEncryptedByKEK: encryptedDEK,
      kekSalt,
      kekIV,
      kdfParams: {
        algorithm: this.kdfAlgorithm,
        iterations: this.kdfIterations,
      },
    };
  }

  /**
   * Recover DEK using hybrid approach - requires both KMS access AND correct passphrase
   */
  async recoverHybridDEK(
    dekEncryptedBySMK: Buffer,
    dekEncryptedByKEK: Buffer,
    passphrase: string,
    kekSalt: Buffer,
    kekIV: Buffer,
    kdfParams?: any
  ): Promise<Buffer> {
    // 1. Derive KEK from passphrase
    const kek = await this.deriveKeyFromPassphrase(passphrase, kekSalt, kdfParams);

    // 2. Decrypt DEK with KEK (verify passphrase is correct)
    try {
      const authTag = dekEncryptedByKEK.slice(-16);
      const ciphertext = dekEncryptedByKEK.slice(0, -16);
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', kek, kekIV);
      decipher.setAuthTag(authTag);
      
      const dekFromKEK = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      // 3. Also decrypt DEK with SMK (for integrity check)
      const dekFromSMK = await this.kmsProvider.decrypt('primary', dekEncryptedBySMK);

      // 4. Verify both methods produce the same DEK
      if (!dekFromKEK.equals(dekFromSMK)) {
        throw new Error('DEK integrity check failed - possible tampering detected');
      }

      // 5. Clear sensitive data
      kek.fill(0);
      dekFromSMK.fill(0);

      return dekFromKEK;
    } catch (error) {
      kek.fill(0);
      throw new Error('Invalid passphrase or corrupted key data');
    }
  }

  /**
   * Encrypt data using a DEK
   */
  encryptData(data: Buffer | string, dek: Buffer): {
    encrypted: Buffer;
    iv: Buffer;
    authTag: Buffer;
  } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    
    const input = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const encrypted = Buffer.concat([
      cipher.update(input),
      cipher.final(),
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return { encrypted, iv, authTag };
  }

  /**
   * Decrypt data using a DEK
   */
  decryptData(
    encrypted: Buffer,
    dek: Buffer,
    iv: Buffer,
    authTag: Buffer
  ): Buffer {
    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
  }

  /**
   * Re-encrypt data with a new passphrase (key rotation for user)
   */
  async reencryptWithNewPassphrase(
    dekEncryptedBySMK: Buffer,
    dekEncryptedByKEK: Buffer,
    oldPassphrase: string,
    newPassphrase: string,
    kekSalt: Buffer,
    kekIV: Buffer,
    kdfParams?: any
  ): Promise<{
    dekEncryptedByKEK: Buffer;
    kekSalt: Buffer;
    kekIV: Buffer;
    kdfParams: any;
  }> {
    // 1. Recover DEK with old passphrase
    const dek = await this.recoverHybridDEK(
      dekEncryptedBySMK,
      dekEncryptedByKEK,
      oldPassphrase,
      kekSalt,
      kekIV,
      kdfParams
    );

    // 2. Generate new salt and derive new KEK
    const newKekSalt = crypto.randomBytes(16);
    const newKek = await this.deriveKeyFromPassphrase(newPassphrase, newKekSalt);

    // 3. Re-encrypt DEK with new KEK
    const newKekIV = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', newKek, newKekIV);
    const newEncryptedDEK = Buffer.concat([
      cipher.update(dek),
      cipher.final(),
      cipher.getAuthTag(),
    ]);

    // 4. Clear sensitive data
    dek.fill(0);
    newKek.fill(0);

    return {
      dekEncryptedByKEK: newEncryptedDEK,
      kekSalt: newKekSalt,
      kekIV: newKekIV,
      kdfParams: {
        algorithm: this.kdfAlgorithm,
        iterations: this.kdfIterations,
      },
    };
  }

  /**
   * Audit log for encryption operations
   */
  async auditEncryptionOperation(
    userId: string,
    operation: 'encrypt' | 'decrypt' | 'rekey',
    resourceType: string,
    resourceId: string,
    success: boolean,
    metadata?: any
  ): Promise<void> {
    log.info('Encryption operation', {
      userId,
      operation,
      resourceType,
      resourceId,
      success,
      metadata,
      timestamp: new Date().toISOString(),
    });
    
    // In production, write to audit database
    // await auditDB.exec`
    //   INSERT INTO encryption_audit_log 
    //   (user_id, operation, resource_type, resource_id, success, metadata, timestamp)
    //   VALUES (${userId}, ${operation}, ${resourceType}, ${resourceId}, ${success}, ${metadata}, NOW())
    // `;
  }
}

// Singleton instance
export const encryptionService = new EncryptionService();