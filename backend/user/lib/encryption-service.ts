import * as crypto from 'crypto';
import { secret } from 'encore.dev/config';

// Encore secret for master encryption
const masterEncryptionSecret = secret('MasterEncryptionSecret');

/**
 * Server-side encryption service for double-layer protection
 * REQUIRED - system will not work without this
 */
export class ServerEncryption {
  private serverKey: Buffer | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Initialize asynchronously
    this.initPromise = this.initialize();
  }

  private async initialize() {
    const secretValue = await masterEncryptionSecret();
    
    if (!secretValue) {
      throw new Error(
        '[ServerEncryption] FATAL: MasterEncryptionSecret not set!\n' +
        'Set it with: encore secret set --type dev,prod MasterEncryptionSecret\n' +
        'Generate value with: openssl rand -base64 32'
      );
    }

    // Derive server key once on startup
    const salt = 'voddly-server-2025'; // Static salt is fine for server key
    
    console.log('[ServerEncryption] Deriving server encryption key...');
    this.serverKey = crypto.pbkdf2Sync(
      secretValue,
      salt,
      100000, // 100k iterations for server key
      32,
      'sha256'
    );
    console.log('[ServerEncryption] Server encryption initialized');
  }

  private async ensureInitialized() {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
    if (!this.serverKey) {
      throw new Error('ServerEncryption not initialized');
    }
  }

  /**
   * Wrap (encrypt) data with server key
   */
  async wrapData(data: Buffer): Promise<{ wrapped: string; iv: string }> {
    await this.ensureInitialized();

    const iv = crypto.randomBytes(12); // 12 bytes for AES-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.serverKey!, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final(),
      cipher.getAuthTag() // 16 bytes auth tag
    ]);

    return {
      wrapped: encrypted.toString('base64'),
      iv: iv.toString('base64')
    };
  }

  /**
   * Unwrap (decrypt) data with server key
   */
  async unwrapData(wrapped: string, iv: string): Promise<Buffer> {
    await this.ensureInitialized();

    const wrappedBuffer = Buffer.from(wrapped, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');
    
    // Split ciphertext and auth tag
    const authTag = wrappedBuffer.slice(-16);
    const ciphertext = wrappedBuffer.slice(0, -16);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.serverKey!, ivBuffer);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
  }

  /**
   * Double-wrap: First with user key, then with server key
   */
  async doubleWrap(userWrappedData: Buffer): Promise<{
    server_wrapped: string;
    server_iv: string;
  }> {
    const result = await this.wrapData(userWrappedData);
    return {
      server_wrapped: result.wrapped,
      server_iv: result.iv
    };
  }

  /**
   * Double-unwrap: First with server key, then user needs to unwrap
   */
  async serverUnwrap(serverWrapped: string, serverIv: string): Promise<Buffer> {
    return this.unwrapData(serverWrapped, serverIv);
  }
}

// Singleton instance
let instance: ServerEncryption | null = null;

export function getServerEncryption(): ServerEncryption {
  if (!instance) {
    instance = new ServerEncryption();
  }
  return instance;
}