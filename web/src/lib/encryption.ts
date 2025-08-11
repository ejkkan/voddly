import { passphraseCache } from "./passphrase-cache";

export class AccountEncryption {
  private masterKey: CryptoKey | null = null;
  private passphrase: string | null = null;
  private accountId: string | null = null;

  /**
   * Initialize encryption with a passphrase
   */
  async initialize(passphrase: string, accountId?: string) {
    if (passphrase.length < 6) {
      throw new Error("Passphrase must be at least 6 characters");
    }
    this.passphrase = passphrase;
    this.accountId = accountId || null;

    // Cache the passphrase if accountId is provided
    if (accountId) {
      passphraseCache.set(accountId, passphrase);
    }

    sessionStorage.setItem("vault_unlocked", "true");
  }

  /**
   * Check if vault is unlocked
   */
  isUnlocked(): boolean {
    // Check in-memory passphrase first
    if (this.passphrase) return true;

    // Then check cache if accountId is available
    if (this.accountId && passphraseCache.has(this.accountId)) {
      return true;
    }

    // Fall back to session storage check
    return sessionStorage.getItem("vault_unlocked") === "true";
  }

  /**
   * Clear passphrase from memory and cache
   */
  lock() {
    this.passphrase = null;
    this.masterKey = null;

    // Clear from cache if accountId is available
    if (this.accountId) {
      passphraseCache.remove(this.accountId);
    }

    sessionStorage.removeItem("vault_unlocked");
  }

  /**
   * Derive encryption key from passphrase using PBKDF2
   */
  async deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(passphrase),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"],
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 500000, // High iteration count for 6-char passphrases
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }

  /**
   * Encrypt credentials for a new source
   */
  async encryptCredentials(
    credentials: any,
    passphrase?: string,
  ): Promise<{
    encrypted: string;
    salt: string;
    iv: string;
  }> {
    const pass = passphrase || this.passphrase;
    if (!pass) {
      throw new Error("No passphrase set. Please unlock the vault first.");
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(pass, salt);

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(credentials));

    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);

    return {
      encrypted: this.bufferToBase64(new Uint8Array(encrypted)),
      salt: this.bufferToBase64(salt),
      iv: this.bufferToBase64(iv),
    };
  }

  /**
   * Decrypt credentials from a source
   */
  async decryptCredentials(
    encryptedData: {
      encrypted: string;
      salt: string;
      iv: string;
    },
    passphrase?: string,
  ): Promise<any> {
    let pass = passphrase || this.passphrase;

    // Try to get from cache if no passphrase provided and accountId is available
    if (!pass && this.accountId) {
      pass = passphraseCache.get(this.accountId);
    }

    if (!pass) {
      // Prompt for passphrase
      const input = prompt("Enter your passphrase to decrypt:");
      if (!input || input.length < 6) {
        throw new Error("Valid passphrase required");
      }
      this.passphrase = input;

      // Cache the passphrase if accountId is available
      if (this.accountId) {
        passphraseCache.set(this.accountId, input);
      }

      sessionStorage.setItem("vault_unlocked", "true");
      return this.decryptCredentials(encryptedData, input);
    }

    const salt = this.base64ToBuffer(encryptedData.salt);
    const iv = this.base64ToBuffer(encryptedData.iv);
    const encrypted = this.base64ToBuffer(encryptedData.encrypted);

    const key = await this.deriveKey(pass, salt);

    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encrypted,
      );

      const decoder = new TextDecoder();
      return JSON.parse(decoder.decode(decrypted));
    } catch (error) {
      throw new Error("Failed to decrypt. Invalid passphrase or corrupted data.");
    }
  }

  /**
   * Get or derive the master key for an account
   */
  async getMasterKey(
    keyData: {
      wrapped_master_key: string;
      salt: string;
      iv: string;
    },
    passphrase?: string,
  ): Promise<CryptoKey> {
    console.log("🔐 getMasterKey: Starting master key derivation");

    if (this.masterKey) {
      console.log("✅ getMasterKey: Using cached master key");
      return this.masterKey;
    }

    let pass = passphrase || this.passphrase;

    // Try to get from cache if no passphrase provided and accountId is available
    if (!pass && this.accountId) {
      pass = passphraseCache.get(this.accountId);
      console.log("🔐 getMasterKey: Retrieved passphrase from cache");
    }

    if (!pass) {
      console.error("❌ getMasterKey: No passphrase available");
      throw new Error("Passphrase required to unlock master key");
    }

    console.log("🔐 getMasterKey: Passphrase available, deriving personal key");

    try {
      // Derive personal key from passphrase
      const salt = this.base64ToBuffer(keyData.salt);
      console.log("🔐 getMasterKey: Salt decoded, length:", salt.length);

      const personalKey = await this.deriveKey(pass, salt);
      console.log("✅ getMasterKey: Personal key derived successfully");

      // Unwrap master key
      const wrapped = this.base64ToBuffer(keyData.wrapped_master_key);
      const iv = this.base64ToBuffer(keyData.iv);

      console.log(
        "🔐 getMasterKey: Attempting to decrypt master key, wrapped length:",
        wrapped.length,
        "iv length:",
        iv.length,
      );

      const masterKeyBytes = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        personalKey,
        wrapped,
      );

      console.log(
        "✅ getMasterKey: Master key decrypted successfully, length:",
        masterKeyBytes.byteLength,
      );

      // Import master key
      this.masterKey = await crypto.subtle.importKey(
        "raw",
        masterKeyBytes,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );

      console.log("✅ getMasterKey: Master key imported successfully");

      // Cache the passphrase for future use if accountId is available
      if (this.accountId && pass && !passphrase) {
        passphraseCache.set(this.accountId, pass);
      }

      return this.masterKey;
    } catch (error) {
      console.error("💥 getMasterKey: Failed to derive master key:", error);

      if (error instanceof Error) {
        if (error.name === "OperationError") {
          throw new Error(
            "Failed to decrypt master key. This usually means the passphrase is incorrect.",
          );
        } else if (error.name === "InvalidAccessError") {
          throw new Error("Invalid key or algorithm parameters.");
        } else {
          throw new Error(`Master key derivation failed: ${error.message}`);
        }
      } else {
        throw new Error("Unknown error during master key derivation");
      }
    }
  }

  /**
   * Set the account ID for this encryption instance
   */
  setAccountId(accountId: string): void {
    this.accountId = accountId;
  }

  /**
   * Get the current account ID
   */
  getAccountId(): string | null {
    return this.accountId;
  }

  /**
   * Decrypt a source using the account master key
   */
  async decryptSource(
    source: {
      encrypted_config: string;
      config_iv: string;
    },
    masterKey: CryptoKey,
  ): Promise<any> {
    console.log("🔐 decryptSource: Starting source decryption");

    try {
      const iv = this.base64ToBuffer(source.config_iv);
      const encrypted = this.base64ToBuffer(source.encrypted_config);

      console.log(
        "🔐 decryptSource: Buffers decoded, iv length:",
        iv.length,
        "encrypted length:",
        encrypted.length,
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        masterKey,
        encrypted,
      );

      console.log(
        "✅ decryptSource: Source decrypted successfully, length:",
        decrypted.byteLength,
      );

      const decoder = new TextDecoder();
      const result = JSON.parse(decoder.decode(decrypted));

      console.log("✅ decryptSource: Source config parsed successfully");
      return result;
    } catch (error) {
      console.error("💥 decryptSource: Failed to decrypt source:", error);

      if (error instanceof Error) {
        if (error.name === "OperationError") {
          throw new Error(
            "Failed to decrypt source configuration. The master key may be invalid.",
          );
        } else if (error.name === "InvalidAccessError") {
          throw new Error("Invalid master key or algorithm parameters.");
        } else if (error instanceof SyntaxError) {
          throw new Error(
            "Failed to parse decrypted source configuration (corrupted data).",
          );
        } else {
          throw new Error(`Source decryption failed: ${error.message}`);
        }
      } else {
        throw new Error("Unknown error during source decryption");
      }
    }
  }

  /**
   * Encrypt a source using the account master key
   */
  async encryptSource(
    credentials: any,
    masterKey: CryptoKey,
  ): Promise<{
    encryptedConfig: string;
    configIv: string;
  }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(credentials));

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      masterKey,
      data,
    );

    return {
      encryptedConfig: this.bufferToBase64(new Uint8Array(encrypted)),
      configIv: this.bufferToBase64(iv),
    };
  }

  /**
   * Helper: Convert buffer to base64
   */
  private bufferToBase64(buffer: Uint8Array): string {
    const binary = String.fromCharCode(...buffer);
    return btoa(binary);
  }

  /**
   * Helper: Convert base64 to buffer
   */
  private base64ToBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    return buffer;
  }

  /**
   * Generate a suggested passphrase
   */
  generateSuggestedPassphrase(): string {
    const words = ["Fire", "Blue", "Star", "Moon", "Sun", "Wind", "Ice", "Rock"];
    const word = words[Math.floor(Math.random() * words.length)];
    const number = Math.floor(Math.random() * 100);
    return `${word}${number.toString().padStart(2, "0")}`;
  }

  /**
   * Validate passphrase strength
   */
  validatePassphrase(passphrase: string): {
    valid: boolean;
    message?: string;
  } {
    if (!passphrase) {
      return { valid: false, message: "Passphrase is required" };
    }
    if (passphrase.length < 6) {
      return { valid: false, message: "Passphrase must be at least 6 characters" };
    }
    if (!/[0-9]/.test(passphrase)) {
      return { valid: false, message: "Passphrase should include at least one number" };
    }
    if (!/[a-zA-Z]/.test(passphrase)) {
      return { valid: false, message: "Passphrase should include at least one letter" };
    }
    return { valid: true };
  }
}
